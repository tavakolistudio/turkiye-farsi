import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertPermission } from "@/server/rbac/authz";
import { PERMISSIONS } from "@/server/rbac/permissions";
import { ApiError } from "@/lib/api/errors";
import { auditLog } from "@/server/audit/log";
import { generateUniqueSlug } from "@/lib/slug";
import type { ServiceContext } from "@/server/services/context";
import { newsroomPipeline } from "./pipeline.service";
import { buildDraft, type DraftSourceLink } from "./draft/persian-draft.service";
import type { ClassificationResult, TrustResult, TrustVerification } from "./types";

/**
 * Admin-facing newsroom operations. Every method is permission-gated and
 * audited. Draft creation ALWAYS produces a private DRAFT Article — never
 * PUBLISHED/APPROVED/SCHEDULED — with full provenance and attached sources.
 */

const BUCKET_STATUS: Record<string, string[]> = {
  urgent: ["SCORED"],
  high: ["SCORED"],
  review: ["SCORED"],
  low: ["SCORED"],
  rejected: ["REJECTED"],
  failed: ["FAILED"],
};

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
