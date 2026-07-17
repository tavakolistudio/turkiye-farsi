import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db";
import {
  articleRepo,
  publicArticleSelect,
  publicCardSelect,
  publishedWhere,
} from "@/server/data/article.repo";
import { ApiError } from "@/lib/api/errors";

/**
 * Read model for the public-facing website (homepage, listings, taxonomy and
 * author pages, static pages). Every query goes through `publishedWhere` so
 * drafts/scheduled/deleted content can never leak, and only public-safe
 * selections (`publicCardSelect` / `publicArticleSelect`) are returned.
 */

export type MostViewedWindow = "today" | "week" | "month" | "all";

function windowStart(window: MostViewedWindow): Date | null {
  const now = Date.now();
  switch (window) {
    case "today":
      return new Date(now - 24 * 60 * 60 * 1000);
    case "week":
      return new Date(now - 7 * 24 * 60 * 60 * 1000);
    case "month":
      return new Date(now - 30 * 24 * 60 * 60 * 1000);
    case "all":
      return null;
  }
}

export const publicSiteService = {
  /**
   * All homepage sections in one round of parallel queries. Each section is
   * independently empty-able so the page renders honest empty states rather
   * than fabricated content.
   */
  async getHomepage() {
    // Themed category rails shown on the homepage (by slug — real categories).
    const CATEGORY_RAILS = [
      "اخبار-ترکیه",
      "اقامت-ترکیه",
      "قوانین-جدید-ترکیه",
      "اقتصاد-ترکیه",
      "استانبول",
      "یالووا",
    ];

    const [
      heroPool,
      breaking,
      latest,
      editorPicks,
      mostViewed,
      categories,
      guides,
      videos,
      impactStory,
    ] = await Promise.all([
      // Hero + sub-features: prefer flagged hero, then fill with recent.
      articleRepo.cards({}, 8, [{ isHero: "desc" }, { publishedAt: "desc" }] as never),
      articleRepo.cards({ isBreaking: true }, 6),
      articleRepo.cards({}, 8),
      articleRepo.cards({ isEditorsPick: true }, 6),
      articleRepo.cards({}, 6, { viewCount: "desc" }),
      prisma.category.findMany({
        where: { slug: { in: CATEGORY_RAILS }, deletedAt: null, isActive: true },
        select: { id: true, name: true, slug: true },
      }),
      articleRepo.cards({ contentType: "GUIDE" }, 4),
      articleRepo.cards({ contentType: "VIDEO" }, 4),
      prisma.article.findFirst({
        where: publishedWhere({
          OR: [
            { whyItMatters: { not: null } },
            { whoIsAffected: { not: null } },
            { whatToDo: { not: null } },
          ],
        }),
        orderBy: { publishedAt: "desc" },
        select: {
          id: true,
          title: true,
          slug: true,
          whyItMatters: true,
          whoIsAffected: true,
          whatToDo: true,
        },
      }),
    ]);

    const hero = heroPool[0] ?? null;
    const subFeatures = heroPool.filter((a) => a.id !== hero?.id).slice(0, 4);

    // Fetch each category rail's latest cards in parallel (bounded set).
    const categoryOrder = new Map(CATEGORY_RAILS.map((slug, i) => [slug, i]));
    const rails = await Promise.all(
      categories
        .sort((a, b) => (categoryOrder.get(a.slug) ?? 99) - (categoryOrder.get(b.slug) ?? 99))
        .map(async (cat) => ({
          id: cat.id,
          title: cat.name,
          slug: cat.slug,
          articles: await articleRepo.cards({ primaryCategoryId: cat.id }, 4),
        })),
    );

    return {
      hero,
      subFeatures,
      breaking,
      latest: latest.filter((a) => a.id !== hero?.id).slice(0, 6),
      editorPicks,
      mostViewed,
      guides,
      videos,
      impactStory,
      categoryRails: rails.filter((r) => r.articles.length > 0),
    };
  },

  /**
   * Active breaking-news ticker items (admin-managed, time-boxed). BreakingNews
   * only stores an articleId (no relation), so we resolve the slug of any
   * linked article in a second query — and only when it is genuinely public.
   */
  async breakingTicker() {
    const now = new Date();
    const items = await prisma.breakingNews.findMany({
      where: {
        isActive: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      take: 8,
      select: { id: true, title: true, url: true, articleId: true, createdAt: true },
    });

    const ids = items.map((i) => i.articleId).filter((id): id is string => !!id);
    const slugMap = new Map<string, string>();
    if (ids.length) {
      const articles = await prisma.article.findMany({
        where: publishedWhere({ id: { in: ids } }),
        select: { id: true, slug: true },
      });
      for (const a of articles) slugMap.set(a.id, a.slug);
    }

    return items.map((i) => ({
      id: i.id,
      title: i.title,
      url: i.url,
      createdAt: i.createdAt,
      articleSlug: i.articleId ? slugMap.get(i.articleId) ?? null : null,
    }));
  },

  /**
   * Top-level active categories for the main navigation. Wrapped in React
   * `cache` so the header and footer share one query per request (no N+1).
   */
  navCategories: cache(async () => {
    return prisma.category.findMany({
      where: { deletedAt: null, isActive: true, parentId: null },
      orderBy: { order: "asc" },
      take: 12,
      select: { id: true, name: true, slug: true },
    });
  }),

  /** Public authors with published work, used by public search filters only. */
  searchAuthors: cache(async () => {
    return prisma.profile.findMany({
      where: {
        isPublic: true,
        user: { deletedAt: null, isActive: true, articles: { some: publishedWhere() } },
      },
      orderBy: { displayName: "asc" },
      take: 100,
      select: { slug: true, displayName: true, user: { select: { name: true } } },
    });
  }),

  async latest(skip: number, take: number) {
    return articleRepo.listCards({ orderBy: { publishedAt: "desc" }, skip, take });
  },

  async breaking(skip: number, take: number) {
    return articleRepo.listCards({ where: { isBreaking: true }, skip, take });
  },

  /**
   * Most-viewed articles for a time window. `all` ranks by the cumulative
   * `viewCount`; bounded windows rank by real PageView events in that window
   * (empty until views accumulate — no fabricated counts).
   */
  async mostViewed(window: MostViewedWindow, take = 20) {
    const start = windowStart(window);
    if (!start) {
      return articleRepo.cards({}, take, { viewCount: "desc" });
    }
    const grouped = await prisma.pageView.groupBy({
      by: ["articleId"],
      where: { articleId: { not: null }, createdAt: { gte: start } },
      _count: { articleId: true },
      orderBy: { _count: { articleId: "desc" } },
      take,
    });
    const ids = grouped.map((g) => g.articleId).filter((id): id is string => !!id);
    if (!ids.length) return [];
    const rows = await prisma.article.findMany({
      where: publishedWhere({ id: { in: ids } }),
      select: publicCardSelect,
    });
    // Preserve the ranked order from the groupBy.
    const rank = new Map(ids.map((id, i) => [id, i]));
    return rows.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
  },

  /** Public author profile + their published articles (paginated). */
  async author(slug: string, skip: number, take: number) {
    const profile = await prisma.profile.findFirst({
      where: { slug, isPublic: true, user: { deletedAt: null, isActive: true } },
      select: {
        displayName: true,
        slug: true,
        avatarUrl: true,
        bio: true,
        expertise: true,
        publicEmail: true,
        twitter: true,
        instagram: true,
        telegram: true,
        linkedin: true,
        website: true,
        userId: true,
      },
    });
    if (!profile) throw ApiError.notFound("نویسنده یافت نشد.");

    const { userId, ...publicProfile } = profile;
    const where = publishedWhere({ authorId: userId });
    const [rows, total] = await Promise.all([
      prisma.article.findMany({
        where,
        orderBy: { publishedAt: "desc" },
        skip,
        take,
        select: publicCardSelect,
      }),
      prisma.article.count({ where }),
    ]);
    return { profile: publicProfile, rows, total };
  },

  /**
   * Full article for the public detail page, plus related + prev/next.
   * Cached per-request so generateMetadata and the page body share one fetch.
   */
  articleDetail: cache(async (slug: string) => {
    const article = await prisma.article.findFirst({
      where: publishedWhere({ slug }),
      select: {
        ...publicArticleSelect,
        id: true,
        isBreaking: true,
        tags: { select: { tag: { select: { id: true, name: true, slug: true } } } },
        primaryCategoryId: true,
      },
    });
    if (!article) throw ApiError.notFound("مطلب یافت نشد.");

    const tagIds = article.tags.map((t) => t.tag.id);
    const [related, adjacency] = await Promise.all([
      articleRepo.relatedCards(article.id, article.primaryCategoryId, tagIds, 6),
      article.publishedAt
        ? articleRepo.prevNext(article.publishedAt, article.id)
        : Promise.resolve({ previous: null, next: null }),
    ]);

    return { article, related, ...adjacency };
  }),

  /** Category archive: the category, its child categories, and paged articles. */
  async categoryPage(slug: string, skip: number, take: number) {
    const category = await prisma.category.findFirst({
      where: { slug, deletedAt: null, isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        parent: { select: { name: true, slug: true } },
        children: {
          where: { deletedAt: null, isActive: true },
          orderBy: { order: "asc" },
          select: { name: true, slug: true },
        },
      },
    });
    if (!category) throw ApiError.notFound("دسته‌بندی یافت نشد.");

    const where = publishedWhere({ primaryCategoryId: category.id });
    const [rows, total] = await Promise.all([
      prisma.article.findMany({ where, orderBy: { publishedAt: "desc" }, skip, take, select: publicCardSelect }),
      prisma.article.count({ where }),
    ]);
    return { category, rows, total };
  },

  /** Tag archive: the tag and its paged articles. */
  async tagPage(slug: string, skip: number, take: number) {
    const tag = await prisma.tag.findFirst({
      where: { slug, deletedAt: null },
      select: { id: true, name: true, slug: true, description: true },
    });
    if (!tag) throw ApiError.notFound("برچسب یافت نشد.");

    const where = publishedWhere({ tags: { some: { tagId: tag.id } } });
    const [rows, total] = await Promise.all([
      prisma.article.findMany({ where, orderBy: { publishedAt: "desc" }, skip, take, select: publicCardSelect }),
      prisma.article.count({ where }),
    ]);
    return { tag, rows, total };
  },

  /**
   * The /news index with optional category + content-type filters and sort.
   * All filters are validated by the caller; unknown values are ignored.
   */
  async newsIndex(opts: {
    skip: number;
    take: number;
    categorySlug?: string;
    contentType?: string;
    sort: "newest" | "oldest" | "most-viewed";
  }) {
    let categoryId: string | undefined;
    if (opts.categorySlug) {
      const cat = await prisma.category.findFirst({
        where: { slug: opts.categorySlug, deletedAt: null },
        select: { id: true },
      });
      categoryId = cat?.id;
      if (!categoryId) return { rows: [], total: 0 };
    }
    const where = publishedWhere({
      ...(categoryId ? { primaryCategoryId: categoryId } : {}),
      ...(opts.contentType ? { contentType: opts.contentType as never } : {}),
    });
    const orderBy =
      opts.sort === "oldest"
        ? { publishedAt: "asc" as const }
        : opts.sort === "most-viewed"
          ? { viewCount: "desc" as const }
          : { publishedAt: "desc" as const };

    const [rows, total] = await Promise.all([
      prisma.article.findMany({ where, orderBy, skip: opts.skip, take: opts.take, select: publicCardSelect }),
      prisma.article.count({ where }),
    ]);
    return { rows, total };
  },

  // ── Static pages ─────────────────────────────────────────
  getStaticPage(slug: string) {
    return prisma.staticPage.findFirst({
      where: { slug, isPublished: true, deletedAt: null },
      select: { slug: true, title: true, bodyJson: true, metaTitle: true, metaDescription: true, updatedAt: true },
    });
  },
};
