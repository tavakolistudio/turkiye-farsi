import "server-only";
import { prisma } from "@/lib/db";
import { publishedWhere } from "@/server/data/article.repo";

/**
 * Read model for SEO feeds (sitemaps, News Sitemap, RSS). Everything here is
 * published-only and public-safe — deleted/draft/scheduled/future content is
 * excluded by `publishedWhere`, and no internal/editorial fields are selected.
 */

export interface SitemapEntry {
  path: string;
  lastModified: Date;
}

export interface NewsEntry {
  slug: string;
  title: string;
  publishedAt: Date;
}

export interface RssEntry {
  slug: string;
  title: string;
  summary: string | null;
  publishedAt: Date | null;
  authorName: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  imageUrl: string | null;
}

/** Google News only wants very recent news; 48h is the accepted window. */
const NEWS_WINDOW_MS = 48 * 60 * 60 * 1000;
/** Max URLs per sitemap file (spec limit is 50k; keep headroom). */
export const SITEMAP_CHUNK = 20_000;

export const seoFeedService = {
  countArticles() {
    return prisma.article.count({ where: publishedWhere() });
  },

  async articles(skip: number, take: number): Promise<SitemapEntry[]> {
    const rows = await prisma.article.findMany({
      where: publishedWhere(),
      orderBy: { publishedAt: "desc" },
      skip,
      take,
      select: { slug: true, updatedAt: true, publishedAt: true },
    });
    return rows.map((r) => ({
      path: `/news/${r.slug}`,
      lastModified: r.updatedAt ?? r.publishedAt ?? new Date(),
    }));
  },

  async categories(): Promise<SitemapEntry[]> {
    const rows = await prisma.category.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: { order: "asc" },
      select: { slug: true, updatedAt: true },
    });
    return rows.map((r) => ({ path: `/category/${r.slug}`, lastModified: r.updatedAt }));
  },

  /** Only tags that actually have published articles (avoids thin archives). */
  async tags(): Promise<SitemapEntry[]> {
    const rows = await prisma.tag.findMany({
      where: { deletedAt: null, articles: { some: { article: publishedWhere() } } },
      orderBy: { name: "asc" },
      select: { slug: true, updatedAt: true },
    });
    return rows.map((r) => ({ path: `/tag/${r.slug}`, lastModified: r.updatedAt }));
  },

  /** Public author profiles that have at least one published article. */
  async authors(): Promise<SitemapEntry[]> {
    const rows = await prisma.profile.findMany({
      where: {
        isPublic: true,
        user: { deletedAt: null, isActive: true, articles: { some: publishedWhere() } },
      },
      select: { slug: true, updatedAt: true },
    });
    return rows.map((r) => ({ path: `/author/${r.slug}`, lastModified: r.updatedAt }));
  },

  async staticPages(): Promise<SitemapEntry[]> {
    const rows = await prisma.staticPage.findMany({
      where: { isPublished: true, deletedAt: null },
      select: { slug: true, updatedAt: true },
    });
    return rows.map((r) => ({ path: `/${r.slug}`, lastModified: r.updatedAt }));
  },

  /** Published articles from the last 48h for the Google News sitemap. */
  async recentNews(limit = 1000): Promise<NewsEntry[]> {
    const since = new Date(Date.now() - NEWS_WINDOW_MS);
    const rows = await prisma.article.findMany({
      where: publishedWhere({ publishedAt: { gte: since, lte: new Date(), not: null } }),
      orderBy: { publishedAt: "desc" },
      take: limit,
      select: { slug: true, title: true, publishedAt: true },
    });
    return rows
      .filter((r): r is { slug: string; title: string; publishedAt: Date } => !!r.publishedAt)
      .map((r) => ({ slug: r.slug, title: r.title, publishedAt: r.publishedAt }));
  },

  /** Items for an RSS feed. Optional category slug / breaking filter. */
  async rss(opts: { limit?: number; categorySlug?: string; breaking?: boolean } = {}): Promise<RssEntry[]> {
    const extra: Parameters<typeof publishedWhere>[0] = {};
    if (opts.breaking) extra.isBreaking = true;
    if (opts.categorySlug) {
      const cat = await prisma.category.findFirst({
        where: { slug: opts.categorySlug, deletedAt: null },
        select: { id: true },
      });
      if (!cat) return [];
      extra.primaryCategoryId = cat.id;
    }
    const rows = await prisma.article.findMany({
      where: publishedWhere(extra),
      orderBy: { publishedAt: "desc" },
      take: opts.limit ?? 30,
      select: {
        slug: true,
        title: true,
        summary: true,
        publishedAt: true,
        author: { select: { name: true, profile: { select: { displayName: true } } } },
        primaryCategory: { select: { name: true, slug: true } },
        featuredImage: { select: { publicUrl: true } },
      },
    });
    return rows.map((r) => ({
      slug: r.slug,
      title: r.title,
      summary: r.summary,
      publishedAt: r.publishedAt,
      authorName: r.author?.profile?.displayName || r.author?.name || null,
      categoryName: r.primaryCategory?.name ?? null,
      categorySlug: r.primaryCategory?.slug ?? null,
      imageUrl: r.featuredImage?.publicUrl ?? null,
    }));
  },
};
