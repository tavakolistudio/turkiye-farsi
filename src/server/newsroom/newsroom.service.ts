import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertPermission, assertAnyPermission } from "@/server/rbac/authz";
import { PERMISSIONS } from "@/server/rbac/permissions";
import { ApiError } from "@/lib/api/errors";
import { auditLog } from "@/server/audit/log";
import { generateUniqueSlug } from "@/lib/slug";
import type { ServiceContext } from "@/server/services/context";
import { newsroomPipeline } from "./pipeline.service";
import { newsroomSettingsService, coerceSettings, DEFAULT_NEWSROOM_SETTINGS, type NewsroomSettings } from "./settings";
import { newsroomSettingsSchema, newsroomSourceCollectionSchema, testFeedSchema } from "@/lib/validations/newsroom";
import { testFeed as runFeedTest } from "./fetch/source-test.service";
import { buildDraft, type DraftSourceLink } from "./draft/persian-draft.service";
import type { ClassificationResult, TrustResult, TrustVerification } from "./types";
import { scoreImportance, scoreBucket } from "./scoring/importance.service";
import { evaluateTrust, type ClusterSourceInfo } from "./scoring/trust.service";
import { classify } from "./classify/classification.service";
import { clusterSourceCount } from "./cluster/cluster.service";
import { revisionService } from "@/server/services/revision.service";

/**
 * Admin-facing newsroom operations. Every method is permission-gated and
 * audited. Draft creation ALWAYS produces a private DRAFT Article — never
 * PUBLISHED/APPROVED/SCHEDULED — with full provenance and attached sources.
 */

async function categoriesForClassify() {
  return prisma.category.findMany({ where: { deletedAt: null }, select: { slug: true, name: true } });
}
async function tagsForClassify() {
  return prisma.tag.findMany({ where: { deletedAt: null }, select: { slug: true, name: true }, take: 300 });
}
async function clusterSourceInfosFor(clusterId: string): Promise<ClusterSourceInfo[]> {
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

/** Audit-safe summary of the powerful toggles (no secrets). */
function killSwitchSummary(s: NewsroomSettings) {
  return {
    isEnabled: s.isEnabled, collectionEnabled: s.collectionEnabled,
    aiEnabled: s.aiEnabled, draftGenerationEnabled: s.draftGenerationEnabled,
    dailyAiBudget: s.dailyAiBudget,
  };
}

export interface ItemListFilter {
  bucket?: "URGENT" | "HIGH" | "REVIEW" | "LOW";
  status?: string;
  page?: number;
  pageSize?: number;
}

export const newsroomService = {
  async listItems(ctx: ServiceContext, filter: ItemListFilter) {
    assertPermission(ctx.actor, PERMISSIONS.NEWSROOM_VIEW);
    const pageSize = Math.min(Math.max(filter.pageSize ?? 20, 1), 100);
    const page = Math.max(filter.page ?? 1, 1);
    const where: Prisma.IngestedNewsItemWhereInput = {
      ...(filter.bucket ? { scoreBucket: filter.bucket } : {}),
      ...(filter.status ? { ingestionStatus: filter.status as never } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.ingestedNewsItem.findMany({
        where,
        orderBy: [{ finalScore: "desc" }, { publishedAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true, title: true, excerpt: true, sourceUrl: true, canonicalUrl: true,
          publishedAt: true, ingestionStatus: true, finalScore: true, ruleScore: true,
          aiScore: true, scoreBucket: true, trustScore: true, verificationStatus: true,
          suggestedCategorySlug: true, scoreReasons: true, createdAt: true,
          source: { select: { id: true, name: true, isOfficial: true } },
        },
      }),
      prisma.ingestedNewsItem.count({ where }),
    ]);
    return { rows, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  },

  async getItem(ctx: ServiceContext, id: string) {
    assertPermission(ctx.actor, PERMISSIONS.NEWSROOM_VIEW);
    const item = await prisma.ingestedNewsItem.findUnique({
      where: { id },
      include: { source: { select: { name: true, isOfficial: true, trustLevel: true } } },
    });
    if (!item) throw ApiError.notFound("آیتم خبری یافت نشد.");
    return item;
  },

  /** Trigger a collection run. Permission-gated; the pipeline enforces the
   * batch lock and every kill switch. */
  async run(ctx: ServiceContext, trigger: "manual" = "manual") {
    assertPermission(ctx.actor, PERMISSIONS.NEWSROOM_RUN_COLLECTION);
    const result = await newsroomPipeline.runCollection({ trigger });
    await auditLog({
      userId: ctx.actor.id, action: "newsroom.run", entityType: "news_batch",
      entityId: result.batchId ?? undefined, ip: ctx.ip, userAgent: ctx.userAgent,
      after: { new: result.newCount, skipped: result.skipped ?? null },
    });
    return result;
  },

  async reject(ctx: ServiceContext, id: string, reason?: string) {
    assertPermission(ctx.actor, PERMISSIONS.NEWSROOM_REJECT);
    const item = await prisma.ingestedNewsItem.findUnique({ where: { id }, select: { id: true } });
    if (!item) throw ApiError.notFound("آیتم خبری یافت نشد.");
    const updated = await prisma.ingestedNewsItem.update({
      where: { id },
      data: { ingestionStatus: "REJECTED", rejectionReason: reason?.slice(0, 300) ?? "رد دستی" },
    });
    await auditLog({ userId: ctx.actor.id, action: "newsroom.reject", entityType: "news_item", entityId: id, ip: ctx.ip, userAgent: ctx.userAgent });
    return updated;
  },

  /**
   * Create a private DRAFT Article from an ingested item and its cluster's
   * sources. Never publishes. Records provenance and attaches ArticleSource
   * links. AI enrichment is optional and failure-tolerant (rule-based baseline).
   */
  async createDraftFromItem(ctx: ServiceContext, id: string) {
    assertPermission(ctx.actor, PERMISSIONS.NEWSROOM_CREATE_DRAFT);
    const item = await prisma.ingestedNewsItem.findUnique({
      where: { id },
      include: {
        source: true,
        clusterLinks: {
          include: { cluster: { include: { items: { include: { newsItem: { include: { source: true } } } } } } },
        },
      },
    });
    if (!item) throw ApiError.notFound("آیتم خبری یافت نشد.");

    // Collect distinct sources across the cluster (fallback: this item's source).
    const clusterItems = item.clusterLinks[0]?.cluster.items ?? [];
    const basis = clusterItems.length
      ? clusterItems.map((ci) => ({ source: ci.newsItem.source, url: ci.newsItem.sourceUrl }))
      : [{ source: item.source, url: item.sourceUrl }];
    const sourceMap = new Map<string, { source: { id: string; name: string }; url: string }>();
    for (const b of basis) {
      if (b.source && !sourceMap.has(b.source.id)) sourceMap.set(b.source.id, { source: b.source, url: b.url });
    }
    const sourceEntries = [...sourceMap.values()];
    const sourceLinks: DraftSourceLink[] = sourceEntries.map((s, i) => ({
      name: s.source.name, url: s.url, isPrimary: i === 0,
    }));

    const classification: ClassificationResult = {
      primaryCategorySlug: item.suggestedCategorySlug,
      secondaryCategorySlugs: [], suggestedTagSlugs: [],
      affectedAudience: null, geographicScope: null, contentType: null,
      sensitivityLevel: (item.verificationStatus && item.suggestedCategorySlug ? "HIGH" : "LOW"),
      needsReview: false,
    };
    const trust: TrustResult = {
      trustScore: item.trustScore ?? 0,
      verificationStatus: (item.verificationStatus ?? "UNVERIFIED") as TrustVerification,
      officialSourceCount: 0, independentSourceCount: sourceMap.size, socialOnly: false,
      conflictingClaims: item.verificationStatus === "CONFLICTING",
      primarySourceAvailable: false,
      requiresHumanFactCheck: item.verificationStatus !== "OFFICIAL_CONFIRMED",
      reasonCodes: [],
    };

    const draft = buildDraft({
      title: item.title, excerpt: item.excerpt, publishedAt: item.publishedAt,
      classification, trust, sources: sourceLinks,
    });

    // Resolve suggested category (existing only — never create taxonomy).
    const primaryCategory = item.suggestedCategorySlug
      ? await prisma.category.findFirst({ where: { slug: item.suggestedCategorySlug, deletedAt: null }, select: { id: true } })
      : null;

    const slug = await generateUniqueSlug(item.title, async (s) => !!(await prisma.article.findFirst({ where: { slug: s }, select: { id: true } })));

    const article = await prisma.$transaction(async (tx) => {
      const created = await tx.article.create({
        data: {
          title: draft.title,
          slug,
          subtitle: draft.subtitle,
          summary: draft.summary,
          bodyJson: draft.bodyJson as unknown as Prisma.InputJsonValue,
          contentType: "NEWS",
          status: "DRAFT", // never anything else
          authorId: ctx.actor.id,
          whyItMatters: draft.whyItMatters,
          whoIsAffected: draft.whoIsAffected,
          whatToDo: draft.whatToDo,
          metaTitle: draft.metaTitle,
          metaDescription: draft.metaDescription,
          factCheckStatus: "UNCHECKED",
          sourceStatus: "ADDED",
          ...(primaryCategory ? { primaryCategoryId: primaryCategory.id } : {}),
        },
      });

      // Attach sources — link to the existing registry Sources the cluster
      // came from. Source URLs are always preserved (attribution).
      let idx = 0;
      for (const [sourceId, s] of sourceMap) {
        await tx.articleSource.create({
          data: { articleId: created.id, sourceId, sourceUrl: s.url, sourceTitle: item.title, isPrimary: idx === 0 },
        }).catch(() => undefined); // ignore unique collisions
        idx++;
      }

      await tx.newsDraftProvenance.create({
        data: {
          articleId: created.id,
          storyClusterId: item.clusterLinks[0]?.clusterId ?? null,
          primaryItemId: item.id,
          ingestionBatchId: item.fetchBatchId,
          generatedByAI: false,
          ruleScore: item.ruleScore, aiScore: item.aiScore, finalScore: item.finalScore,
          trustScore: item.trustScore,
          verificationStatus: item.verificationStatus ?? "UNVERIFIED",
          scoreReasons: item.scoreReasons ?? undefined,
          requiresHumanReview: true,
        },
      });

      await tx.ingestedNewsItem.update({ where: { id: item.id }, data: { ingestionStatus: "DRAFTED" } });
      return created;
    });

    await auditLog({ userId: ctx.actor.id, action: "newsroom.create_draft", entityType: "article", entityId: article.id, ip: ctx.ip, userAgent: ctx.userAgent, after: { fromItem: item.id } });
    return { articleId: article.id, slug: article.slug };
  },

  // ── Reprocess ───────────────────────────────────────────────
  /**
   * Re-run classification, importance scoring and trust evaluation for an
   * existing item using the CURRENT settings/weights. Idempotent — safe to run
   * repeatedly. Does not create or touch any draft, and never re-fetches.
   */
  async reprocessItem(ctx: ServiceContext, id: string) {
    assertPermission(ctx.actor, PERMISSIONS.NEWSROOM_REVIEW);
    const item = await prisma.ingestedNewsItem.findUnique({
      where: { id },
      include: { source: true, clusterLinks: { select: { clusterId: true } } },
    });
    if (!item) throw ApiError.notFound("آیتم خبری یافت نشد.");

    const settings = await newsroomSettingsService.get();
    const clusterId = item.clusterLinks[0]?.clusterId ?? null;
    const srcCount = clusterId ? await clusterSourceCount(clusterId) : 1;

    const importance = scoreImportance(
      {
        normalizedText: item.normalizedText ?? `${item.title} ${item.excerpt ?? ""}`,
        sourceTrustLevel: item.source.trustLevel,
        sourceIsOfficial: item.source.isOfficial,
        clusterSourceCount: srcCount,
        publishedAt: item.publishedAt,
      },
      settings.scoringWeights,
    );
    const bucket = scoreBucket(importance.ruleScore);
    const classification = classify(`${item.title} ${item.excerpt ?? ""}`, await categoriesForClassify(), await tagsForClassify());
    const trust = evaluateTrust({
      sources: clusterId ? await clusterSourceInfosFor(clusterId) : [{ sourceType: item.source.sourceType, isOfficial: item.source.isOfficial, trustLevel: item.source.trustLevel, hasArticleUrl: !!item.sourceUrl }],
      hasLegalClaim: classification.sensitivityLevel === "HIGH",
    });

    // Preserve DRAFTED items; otherwise reflect the new bucket.
    const status = item.ingestionStatus === "DRAFTED" ? "DRAFTED" : bucket === "REJECT" ? "REJECTED" : "SCORED";
    const updated = await prisma.ingestedNewsItem.update({
      where: { id },
      data: {
        ingestionStatus: status,
        ruleScore: importance.ruleScore,
        finalScore: item.aiScore != null ? Math.round((importance.ruleScore + item.aiScore) / 2) : importance.ruleScore,
        scoreBucket: bucket,
        trustScore: trust.trustScore,
        verificationStatus: trust.verificationStatus,
        suggestedCategorySlug: classification.primaryCategorySlug,
        scoreReasons: { importance: importance.reasons, trust: trust.reasonCodes } as object,
        rejectionReason: bucket === "REJECT" && status !== "DRAFTED" ? "امتیاز اهمیت پایین" : null,
      },
    });
    await auditLog({ userId: ctx.actor.id, action: "newsroom.reprocess", entityType: "news_item", entityId: id, ip: ctx.ip, userAgent: ctx.userAgent, after: { ruleScore: importance.ruleScore, bucket } });
    return { id: updated.id, ruleScore: updated.ruleScore, finalScore: updated.finalScore, scoreBucket: updated.scoreBucket, trustScore: updated.trustScore };
  },

  // ── Regenerate draft ────────────────────────────────────────
  /**
   * Rebuild the Persian draft for an item's existing article. Refuses to clobber
   * a human-edited or advanced draft unless `force` is set; always snapshots a
   * revision first so nothing is lost. Never publishes.
   */
  async regenerateDraft(ctx: ServiceContext, id: string, opts: { force?: boolean } = {}) {
    assertPermission(ctx.actor, PERMISSIONS.NEWSROOM_REGENERATE);
    const prov = await prisma.newsDraftProvenance.findFirst({
      where: { primaryItemId: id },
      orderBy: { createdAt: "desc" },
    });
    if (!prov?.articleId) throw ApiError.notFound("برای این خبر هنوز پیش‌نویسی ساخته نشده است.");
    const article = await prisma.article.findUnique({ where: { id: prov.articleId } });
    if (!article) throw ApiError.notFound("مطلب مرتبط یافت نشد.");
    if (article.status !== "DRAFT") {
      throw ApiError.validation("این مطلب از حالت پیش‌نویس خارج شده و بازتولید نمی‌شود.");
    }
    // Guard against clobbering human edits.
    const humanEdited = (article.currentVersion ?? 0) > 0 || (await prisma.articleRevision.count({ where: { articleId: article.id } })) > 0;
    if (humanEdited && !opts.force) {
      throw ApiError.conflict("این پیش‌نویس ویرایش انسانی دارد؛ برای بازنویسی، تأیید صریح لازم است (force).");
    }

    const item = await prisma.ingestedNewsItem.findUnique({
      where: { id },
      include: { source: true, clusterLinks: { include: { cluster: { include: { items: { include: { newsItem: { include: { source: true } } } } } } } } },
    });
    if (!item) throw ApiError.notFound("آیتم خبری یافت نشد.");

    const clusterItems = item.clusterLinks[0]?.cluster.items ?? [];
    const basis = clusterItems.length ? clusterItems.map((ci) => ({ source: ci.newsItem.source, url: ci.newsItem.sourceUrl })) : [{ source: item.source, url: item.sourceUrl }];
    const sourceMap = new Map<string, { name: string; url: string }>();
    for (const b of basis) if (b.source && !sourceMap.has(b.source.id)) sourceMap.set(b.source.id, { name: b.source.name, url: b.url });
    const sourceLinks: DraftSourceLink[] = [...sourceMap.values()].map((s, i) => ({ name: s.name, url: s.url, isPrimary: i === 0 }));

    const classification: ClassificationResult = {
      primaryCategorySlug: item.suggestedCategorySlug, secondaryCategorySlugs: [], suggestedTagSlugs: [],
      affectedAudience: null, geographicScope: null, contentType: null,
      sensitivityLevel: item.verificationStatus ? "HIGH" : "LOW", needsReview: false,
    };
    const trust: TrustResult = {
      trustScore: item.trustScore ?? 0, verificationStatus: (item.verificationStatus ?? "UNVERIFIED") as TrustVerification,
      officialSourceCount: 0, independentSourceCount: sourceMap.size, socialOnly: false,
      conflictingClaims: item.verificationStatus === "CONFLICTING", primarySourceAvailable: false,
      requiresHumanFactCheck: item.verificationStatus !== "OFFICIAL_CONFIRMED", reasonCodes: [],
    };
    const draft = buildDraft({ title: item.title, excerpt: item.excerpt, publishedAt: item.publishedAt, classification, trust, sources: sourceLinks });

    await prisma.$transaction(async (tx) => {
      // Snapshot the current content before overwriting (nothing is lost).
      await revisionService.createSnapshot(tx, article.id, ctx.actor.id, "بازتولید خودکار پیش‌نویس");
      await tx.article.update({
        where: { id: article.id },
        data: {
          title: draft.title, subtitle: draft.subtitle, summary: draft.summary,
          bodyJson: draft.bodyJson as unknown as Prisma.InputJsonValue,
          whyItMatters: draft.whyItMatters, whoIsAffected: draft.whoIsAffected, whatToDo: draft.whatToDo,
          metaTitle: draft.metaTitle, metaDescription: draft.metaDescription,
          status: "DRAFT", // stays DRAFT — never auto-advanced
          currentVersion: { increment: 1 },
        },
      });
      await tx.newsDraftProvenance.update({
        where: { id: prov.id },
        data: { aiGeneratedAt: prov.generatedByAI ? new Date() : prov.aiGeneratedAt, finalScore: item.finalScore, trustScore: item.trustScore },
      });
    });

    await auditLog({ userId: ctx.actor.id, action: "newsroom.regenerate", entityType: "article", entityId: article.id, ip: ctx.ip, userAgent: ctx.userAgent, after: { fromItem: id, forced: !!opts.force } });
    // Rule-based regeneration has no AI cost; AI-assisted regen would report here.
    return { articleId: article.id, costEstimate: 0 };
  },

  // ── Settings ────────────────────────────────────────────────
  /** Read settings. Requires view. */
  async getSettings(ctx: ServiceContext): Promise<NewsroomSettings> {
    assertPermission(ctx.actor, PERMISSIONS.NEWSROOM_VIEW);
    return newsroomSettingsService.get();
  },

  /** Update settings. Requires manage_scoring OR the sensitive settings perm. */
  async updateSettings(ctx: ServiceContext, raw: unknown): Promise<NewsroomSettings> {
    assertAnyPermission(ctx.actor, [PERMISSIONS.NEWSROOM_MANAGE_SCORING, PERMISSIONS.SETTINGS_MANAGE]);
    const parsed = newsroomSettingsSchema.parse(raw);
    const before = await newsroomSettingsService.get();
    const saved = await newsroomSettingsService.save(coerceSettings({ ...before, ...parsed }));
    await auditLog({
      userId: ctx.actor.id, action: "newsroom.settings.update", entityType: "site_setting",
      entityId: "newsroom", ip: ctx.ip, userAgent: ctx.userAgent,
      before: killSwitchSummary(before), after: killSwitchSummary(saved),
    });
    return saved;
  },

  /** Reset to conservative defaults (collection + AI OFF). */
  async resetSettings(ctx: ServiceContext): Promise<NewsroomSettings> {
    assertAnyPermission(ctx.actor, [PERMISSIONS.NEWSROOM_MANAGE_SCORING, PERMISSIONS.SETTINGS_MANAGE]);
    const saved = await newsroomSettingsService.save(DEFAULT_NEWSROOM_SETTINGS);
    await auditLog({
      userId: ctx.actor.id, action: "newsroom.settings.reset", entityType: "site_setting",
      entityId: "newsroom", ip: ctx.ip, userAgent: ctx.userAgent,
    });
    return saved;
  },

  // ── Sources (collection config) ─────────────────────────────
  async listCollectionSources(ctx: ServiceContext) {
    assertPermission(ctx.actor, PERMISSIONS.NEWSROOM_VIEW);
    return prisma.source.findMany({
      where: { deletedAt: null },
      orderBy: [{ isEnabled: "desc" }, { priority: "desc" }, { name: "asc" }],
      select: {
        id: true, name: true, slug: true, feedUrl: true, collectionMethod: true,
        isEnabled: true, trustLevel: true, priority: true, isOfficial: true,
        lastFetchedAt: true, lastSuccessfulFetchAt: true, consecutiveFailures: true,
        lastEtag: true, lastModifiedHeader: true, fetchIntervalMinutes: true, maxExcerptLength: true,
        allowFullTextFetch: true,
        _count: { select: { ingestedItems: true } },
      },
    });
  },

  async updateSourceCollection(ctx: ServiceContext, id: string, raw: unknown) {
    assertPermission(ctx.actor, PERMISSIONS.NEWSROOM_MANAGE_SOURCES);
    const input = newsroomSourceCollectionSchema.parse(raw);
    const existing = await prisma.source.findFirst({ where: { id, deletedAt: null }, select: { id: true, name: true, isEnabled: true } });
    if (!existing) throw ApiError.notFound("منبع یافت نشد.");
    // A source can only be enabled for collection if it has a machine-readable feed.
    if (input.isEnabled && input.collectionMethod !== "MANUAL" && !input.feedUrl) {
      throw ApiError.validation("برای فعال‌سازی جمع‌آوری، نشانی فید لازم است.");
    }
    const updated = await prisma.source.update({
      where: { id },
      data: {
        feedUrl: input.feedUrl ?? null,
        collectionMethod: input.collectionMethod,
        trustLevel: input.trustLevel,
        priority: input.priority,
        isEnabled: input.isEnabled,
        fetchIntervalMinutes: input.fetchIntervalMinutes,
        maxExcerptLength: input.maxExcerptLength,
        allowFullTextFetch: input.allowFullTextFetch,
        // Any config change confirms a human reviewed collection for this source.
        termsReviewedAt: new Date(),
        robotsReviewedAt: new Date(),
      },
    });
    await auditLog({
      userId: ctx.actor.id, action: "newsroom.source.update", entityType: "source", entityId: id,
      ip: ctx.ip, userAgent: ctx.userAgent,
      before: { isEnabled: existing.isEnabled }, after: { isEnabled: updated.isEnabled, method: updated.collectionMethod },
    });
    return updated;
  },

  async toggleSourceEnabled(ctx: ServiceContext, id: string, enabled: boolean) {
    assertPermission(ctx.actor, PERMISSIONS.NEWSROOM_MANAGE_SOURCES);
    const existing = await prisma.source.findFirst({ where: { id, deletedAt: null }, select: { id: true, feedUrl: true, collectionMethod: true } });
    if (!existing) throw ApiError.notFound("منبع یافت نشد.");
    if (enabled && existing.collectionMethod !== "MANUAL" && !existing.feedUrl) {
      throw ApiError.validation("برای فعال‌سازی، ابتدا نشانی فید را تنظیم کنید.");
    }
    const updated = await prisma.source.update({ where: { id }, data: { isEnabled: enabled } });
    await auditLog({
      userId: ctx.actor.id, action: enabled ? "newsroom.source.enable" : "newsroom.source.disable",
      entityType: "source", entityId: id, ip: ctx.ip, userAgent: ctx.userAgent,
    });
    return updated;
  },

  /** Test a feed URL without persisting anything (SSRF-hardened). */
  async testFeed(ctx: ServiceContext, raw: unknown) {
    assertPermission(ctx.actor, PERMISSIONS.NEWSROOM_MANAGE_SOURCES);
    const { feedUrl } = testFeedSchema.parse(raw);
    return runFeedTest(feedUrl);
  },

  async stats(ctx: ServiceContext) {
    assertPermission(ctx.actor, PERMISSIONS.NEWSROOM_VIEW);
    const [items, byBucket, lastBatch, drafts] = await Promise.all([
      prisma.ingestedNewsItem.count(),
      prisma.ingestedNewsItem.groupBy({ by: ["scoreBucket"], _count: true }),
      prisma.newsFetchBatch.findFirst({ orderBy: { startedAt: "desc" } }),
      prisma.newsDraftProvenance.count(),
    ]);
    return { items, byBucket, lastBatch, drafts };
  },
};
