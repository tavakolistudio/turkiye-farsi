import "server-only";
import type { CollectionMethod, Source, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { newsroomSettingsService, type NewsroomSettings } from "./settings";
import { safeFetchFeed } from "./fetch/safe-fetch";
import { parseFeed } from "./fetch/parse-feed";
import type { ParsedFeedItem } from "./types";
import { normalizeItem } from "./normalize/normalization.service";
import { findDuplicate } from "./dedup/duplicate.service";
import { createClusterForItem, addItemToClusterOf, clusterSourceCount } from "./cluster/cluster.service";
import { scoreImportance, scoreBucket } from "./scoring/importance.service";
import { evaluateTrust, type ClusterSourceInfo } from "./scoring/trust.service";
import { classify, type TaxonomyEntry } from "./classify/classification.service";
import { logJob } from "./job-log";
import { notifyEditorial } from "./notifications";

/**
 * The collection pipeline orchestrator. Composes the independent stages:
 *   fetch → normalize → dedup → cluster → rule-score → classify → trust.
 *
 * Guarantees:
 *  - honours every kill switch (isEnabled/collectionEnabled) up front,
 *  - a single batch lock prevents concurrent runs (idempotent re-entry),
 *  - unique(sourceId, externalId) makes re-ingesting a feed a no-op,
 *  - each item is processed in its own try/catch so one failure never aborts
 *    the batch, and every stage is logged to NewsPipelineJobLog.
 *
 * Draft generation is intentionally NOT automatic here — drafts are created by
 * an editor from the review queue (newsroom.service.createDraftFromItem). This
 * pipeline never publishes anything.
 */

// Methods we actually poll in the MVP. WEB_PAGE_ALLOWED is deliberately excluded.
const ALLOWED_METHODS: CollectionMethod[] = ["RSS", "ATOM", "JSON_FEED", "OFFICIAL_API"];
const RUNNING_STALE_MS = 30 * 60 * 1000;

export interface RunResult {
  batchId: string | null;
  skipped?: string;
  sourceCount: number;
  fetchedCount: number;
  newCount: number;
  duplicateCount: number;
  rejectedCount: number;
  failedCount: number;
}

export const newsroomPipeline = {
  async runCollection(opts: { trigger: "cron" | "manual" }): Promise<RunResult> {
    const settings = await newsroomSettingsService.get();
    if (!settings.isEnabled || !settings.collectionEnabled) {
      return empty("disabled");
    }

    // Batch lock — refuse to start if a fresh run is already in progress.
    const running = await prisma.newsFetchBatch.findFirst({
      where: { status: "RUNNING", startedAt: { gte: new Date(Date.now() - RUNNING_STALE_MS) } },
      select: { id: true },
    });
    if (running) return { ...empty("already_running"), batchId: running.id };

    const batch = await prisma.newsFetchBatch.create({
      data: { status: "RUNNING", trigger: opts.trigger },
    });

    const counts = { sourceCount: 0, fetchedCount: 0, newCount: 0, duplicateCount: 0, rejectedCount: 0, failedCount: 0 };
    try {
      const sources = await prisma.source.findMany({
        where: {
          isEnabled: true,
          deletedAt: null,
          collectionMethod: { in: ALLOWED_METHODS },
          feedUrl: { not: null },
        },
        orderBy: [{ priority: "desc" }, { lastFetchedAt: "asc" }],
        take: settings.maxSourcesPerRun,
      });
      const taxonomy = await loadTaxonomy();

      for (const source of sources) {
        counts.sourceCount++;
        try {
          const perSource = await fetchAndProcessSource(source, batch.id, settings, taxonomy);
          counts.fetchedCount += perSource.fetched;
          counts.newCount += perSource.created;
          counts.duplicateCount += perSource.duplicates;
          counts.rejectedCount += perSource.rejected;
          counts.failedCount += perSource.failed;
        } catch (err) {
          counts.failedCount++;
          await onSourceFailure(source, err, batch.id);
        }
      }

      await prisma.newsFetchBatch.update({
        where: { id: batch.id },
        data: {
          status: counts.failedCount > 0 && counts.newCount === 0 ? "PARTIAL" : "COMPLETED",
          completedAt: new Date(),
          ...counts,
        },
      });
    } catch (err) {
      await prisma.newsFetchBatch.update({
        where: { id: batch.id },
        data: { status: "FAILED", completedAt: new Date(), errorSummary: String(err).slice(0, 500), ...counts },
      });
      await notifyEditorial("NEWSROOM_PIPELINE_FAILURE", "اجرای خط لوله اتاق خبر با خطا متوقف شد.");
    }

    return { batchId: batch.id, ...counts };
  },
};

interface SourceOutcome {
  fetched: number;
  created: number;
  duplicates: number;
  rejected: number;
  failed: number;
}

async function fetchAndProcessSource(
  source: Source,
  batchId: string,
  settings: NewsroomSettings,
  taxonomy: { categories: TaxonomyEntry[]; tags: TaxonomyEntry[] },
): Promise<SourceOutcome> {
  const out: SourceOutcome = { fetched: 0, created: 0, duplicates: 0, rejected: 0, failed: 0 };
  const startedAt = new Date();

  const res = await safeFetchFeed(source.feedUrl!, {
    timeoutMs: settings.fetchTimeout,
    etag: source.lastEtag,
    lastModified: source.lastModifiedHeader,
  });
  if (res.notModified) {
    await touchSource(source.id, { success: true });
    await logJob({ batchId, stage: "FETCH", status: "SKIPPED", metadata: { source: source.slug, notModified: true }, startedAt });
    return out;
  }
  const feed = parseFeed(res.body, res.contentType);
  const items = feed.items.slice(0, settings.maxItemsPerSource);
  await logJob({ batchId, stage: "FETCH", status: "SUCCESS", metadata: { source: source.slug, items: items.length }, startedAt });

  for (const parsed of items) {
    out.fetched++;
    try {
      const r = await processItem(source, parsed, batchId, settings, taxonomy);
      if (r === "duplicate") out.duplicates++;
      else if (r === "rejected") out.rejected++;
      else out.created++;
    } catch (err) {
      out.failed++;
      await logJob({ batchId, newsItemId: null, stage: "NORMALIZE", status: "FAILED", error: err, metadata: { source: source.slug } });
    }
  }
  await touchSource(source.id, { success: true, etag: res.etag, lastModified: res.lastModified });
  return out;
}

type ItemOutcome = "created" | "duplicate" | "rejected";

async function processItem(
  source: Source,
  parsed: ParsedFeedItem,
  batchId: string,
  settings: NewsroomSettings,
  taxonomy: { categories: TaxonomyEntry[]; tags: TaxonomyEntry[] },
): Promise<ItemOutcome> {
  const norm = normalizeItem({ item: parsed, sourceBrand: source.name, maxExcerptLength: source.maxExcerptLength });
  if (!norm.externalId || !norm.title) return "rejected";

  // ── Dedup ──────────────────────────────────────────────────
  const dup = await findDuplicate({
    sourceId: source.id,
    externalId: norm.externalId,
    canonicalUrl: norm.canonicalUrl,
    titleHash: norm.titleHash,
    normalizedTitle: norm.normalizedTitle,
    publishedAt: norm.publishedAt,
  });

  let clusterSibling: string | null = null;
  if (dup) {
    // Levels 1-2 (same canonical URL / same source externalId) are true
    // duplicates → skip. Levels 3-4 (same/similar title) are the same STORY:
    // from the SAME source they are a re-post (skip); from a DIFFERENT source
    // they are kept and clustered together for multi-source confirmation.
    if (dup.level <= 2) {
      await logJob({ batchId, stage: "DEDUPLICATE", status: "SKIPPED", metadata: { level: dup.level, of: dup.duplicateOfId } });
      return "duplicate";
    }
    const other = await prisma.ingestedNewsItem.findUnique({ where: { id: dup.duplicateOfId }, select: { sourceId: true } });
    if (other?.sourceId === source.id) {
      await logJob({ batchId, stage: "DEDUPLICATE", status: "SKIPPED", metadata: { level: dup.level, sameSource: true } });
      return "duplicate";
    }
    clusterSibling = dup.duplicateOfId;
  }

  // ── Persist item ───────────────────────────────────────────
  const item = await prisma.ingestedNewsItem.create({
    data: {
      sourceId: source.id,
      externalId: norm.externalId,
      sourceUrl: norm.sourceUrl,
      canonicalUrl: norm.canonicalUrl,
      title: norm.title,
      originalLanguage: norm.originalLanguage,
      publishedAt: norm.publishedAt,
      authorName: norm.authorName,
      excerpt: norm.excerpt,
      rawMetadataJson: (norm.rawMetadataJson ?? undefined) as Prisma.InputJsonValue | undefined,
      contentHash: norm.contentHash,
      titleHash: norm.titleHash,
      normalizedTitle: norm.normalizedTitle,
      normalizedText: norm.normalizedText,
      fetchBatchId: batchId,
      ingestionStatus: "NORMALIZED",
    },
  });

  // ── Cluster ────────────────────────────────────────────────
  let clusterId: string;
  if (clusterSibling) {
    clusterId = (await addItemToClusterOf(clusterSibling, item.id, dup!.similarity)) ?? (await createClusterForItem(item.id, norm.normalizedTitle, norm.titleHash));
  } else {
    clusterId = await createClusterForItem(item.id, norm.normalizedTitle, norm.titleHash);
  }
  const srcCount = await clusterSourceCount(clusterId);

  // ── Rule score ─────────────────────────────────────────────
  const importance = scoreImportance(
    {
      normalizedText: norm.normalizedText,
      sourceTrustLevel: source.trustLevel,
      sourceIsOfficial: source.isOfficial,
      clusterSourceCount: srcCount,
      publishedAt: norm.publishedAt,
    },
    settings.scoringWeights,
  );
  const bucket = scoreBucket(importance.ruleScore);

  // ── Classify ───────────────────────────────────────────────
  const classification = classify(`${norm.title} ${norm.excerpt ?? ""}`, taxonomy.categories, taxonomy.tags);

  // ── Trust ──────────────────────────────────────────────────
  const clusterSources = await clusterSourceInfos(clusterId);
  const trust = evaluateTrust({
    sources: clusterSources,
    hasLegalClaim: classification.sensitivityLevel === "HIGH",
  });

  const finalStatus = bucket === "REJECT" ? "REJECTED" : "SCORED";
  await prisma.ingestedNewsItem.update({
    where: { id: item.id },
    data: {
      ingestionStatus: finalStatus,
      rejectionReason: bucket === "REJECT" ? "امتیاز اهمیت پایین" : null,
      ruleScore: importance.ruleScore,
      finalScore: importance.ruleScore, // AI merge (when enabled) refines this later
      scoreBucket: bucket,
      trustScore: trust.trustScore,
      verificationStatus: trust.verificationStatus,
      suggestedCategorySlug: classification.primaryCategorySlug,
      scoreReasons: { importance: importance.reasons, trust: trust.reasonCodes } as object,
    },
  });
  await logJob({ batchId, newsItemId: item.id, stage: "SCORE", status: "SUCCESS", metadata: { ruleScore: importance.ruleScore, bucket, trustScore: trust.trustScore } });

  // ── Notify on urgent, well-formed items ────────────────────
  if (bucket === "URGENT") {
    await notifyEditorial("NEWSROOM_URGENT", `خبر مهم (امتیاز ${importance.ruleScore}): ${norm.title.slice(0, 120)}`);
  }
  // No detector sets TrustContext.conflicting today (claim-vs-claim comparison
  // across clustered sources isn't built yet). This fires the moment one
  // lands; until then it's a dormant no-op, not an invented trigger.
  if (trust.verificationStatus === "CONFLICTING") {
    await notifyEditorial("NEWSROOM_SOURCE_CONFLICT", `منابع در مورد «${norm.title.slice(0, 120)}» با هم تناقض دارند — نیازمند بررسی انسانی.`);
  }

  return bucket === "REJECT" ? "rejected" : "created";
}

async function clusterSourceInfos(clusterId: string): Promise<ClusterSourceInfo[]> {
  const links = await prisma.newsStoryClusterItem.findMany({
    where: { clusterId },
    select: { newsItem: { select: { sourceUrl: true, source: { select: { sourceType: true, isOfficial: true, trustLevel: true } } } } },
  });
  return links.map((l) => ({
    sourceType: l.newsItem.source.sourceType,
    isOfficial: l.newsItem.source.isOfficial,
    trustLevel: l.newsItem.source.trustLevel,
    hasArticleUrl: !!l.newsItem.sourceUrl,
  }));
}

async function loadTaxonomy() {
  const [categories, tags] = await Promise.all([
    prisma.category.findMany({ where: { deletedAt: null }, select: { slug: true, name: true } }),
    prisma.tag.findMany({ where: { deletedAt: null }, select: { slug: true, name: true }, take: 300 }),
  ]);
  return { categories, tags };
}

async function touchSource(id: string, opts: { success: boolean; etag?: string | null; lastModified?: string | null }) {
  await prisma.source.update({
    where: { id },
    data: {
      lastFetchedAt: new Date(),
      ...(opts.success
        ? {
            lastSuccessfulFetchAt: new Date(),
            consecutiveFailures: 0,
            // Store caching validators only when the server actually returned them.
            ...(opts.etag !== undefined ? { lastEtag: opts.etag } : {}),
            ...(opts.lastModified !== undefined ? { lastModifiedHeader: opts.lastModified } : {}),
          }
        : { consecutiveFailures: { increment: 1 } }),
    },
  });
}

async function onSourceFailure(source: Source, err: unknown, batchId: string) {
  await touchSource(source.id, { success: false });
  await logJob({ batchId, stage: "FETCH", status: "FAILED", error: err, metadata: { source: source.slug } });
  const updated = await prisma.source.findUnique({ where: { id: source.id }, select: { consecutiveFailures: true } });
  if (updated && updated.consecutiveFailures >= 3) {
    await notifyEditorial("NEWSROOM_SOURCE_FAILING", `منبع «${source.name}» چند بار پیاپی ناموفق بوده است.`);
  }
}

function empty(skipped: string): RunResult {
  return { batchId: null, skipped, sourceCount: 0, fetchedCount: 0, newCount: 0, duplicateCount: 0, rejectedCount: 0, failedCount: 0 };
}
