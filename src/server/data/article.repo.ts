import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

/** Include used when returning a full article to the admin. */
export const adminArticleInclude = {
  author: { select: { id: true, name: true } },
  primaryCategory: { select: { id: true, name: true, slug: true } },
  featuredImage: { select: { id: true, publicUrl: true, alt: true } },
  ogImage: { select: { id: true, publicUrl: true } },
  categories: { include: { category: { select: { id: true, name: true, slug: true } } } },
  tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
  sources: { include: { source: { select: { id: true, name: true, slug: true } } } },
  media: { include: { media: { select: { id: true, publicUrl: true, mimeType: true } } } },
} satisfies Prisma.ArticleInclude;

/** Public-safe selection: no internal/editorial/scheduling fields leak. */
export const publicArticleCardSelect = {
  id: true,
  title: true,
  slug: true,
  subtitle: true,
  summary: true,
  contentType: true,
  isBreaking: true,
  readingTime: true,
  publishedAt: true,
  updatedAt: true,
  viewCount: true,
  author: { select: { name: true, profile: { select: { slug: true, displayName: true, avatarUrl: true } } } },
  primaryCategory: { select: { name: true, slug: true } },
  featuredImage: { select: { publicUrl: true, alt: true, caption: true, width: true, height: true } },
  tags: { select: { tag: { select: { name: true, slug: true } } } },
} satisfies Prisma.ArticleSelect;

export const publicArticleSelect = {
  ...publicArticleCardSelect,
  bodyJson: true,
  whyItMatters: true,
  whoIsAffected: true,
  whatToDo: true,
  changeWarning: true,
  canonicalUrl: true,
  noindex: true,
  author: {
    select: {
      name: true,
      profile: {
        select: {
          slug: true, displayName: true, avatarUrl: true, bio: true, expertise: true,
          twitter: true, instagram: true, telegram: true, linkedin: true, website: true,
        },
      },
    },
  },
  categories: { select: { category: { select: { name: true, slug: true } }, isPrimary: true } },
  sources: {
    select: { sourceUrl: true, sourceTitle: true, isPrimary: true, source: { select: { name: true, slug: true } } },
  },
  corrections: {
    where: { isPublished: true, deletedAt: null },
    orderBy: [{ order: "asc" as const }, { publishedAt: "asc" as const }],
    select: { title: true, description: true, correctionType: true, publishedAt: true },
  },
} satisfies Prisma.ArticleSelect;

/** Only genuinely-published articles are exposed publicly. */
export function publishedWhere(extra: Prisma.ArticleWhereInput = {}): Prisma.ArticleWhereInput {
  return {
    status: "PUBLISHED",
    deletedAt: null,
    publishedAt: { not: null, lte: new Date() },
    ...extra,
  };
}

export const articleRepo = {
  async slugExists(slug: string, excludeId?: string) {
    const f = await prisma.article.findFirst({
      where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    return !!f;
  },

  findById(id: string) {
    return prisma.article.findUnique({ where: { id }, include: adminArticleInclude });
  },

  findByIdBasic(id: string) {
    return prisma.article.findUnique({ where: { id } });
  },

  async list(args: {
    where: Prisma.ArticleWhereInput;
    orderBy: Prisma.ArticleOrderByWithRelationInput;
    skip: number;
    take: number;
  }) {
    const [rows, total] = await Promise.all([
      prisma.article.findMany({
        where: args.where,
        orderBy: args.orderBy,
        skip: args.skip,
        take: args.take,
        include: {
          author: { select: { id: true, name: true } },
          primaryCategory: { select: { id: true, name: true } },
          featuredImage: { select: { publicUrl: true } },
          _count: { select: { tags: true, sources: true } },
        },
      }),
      prisma.article.count({ where: args.where }),
    ]);
    return { rows, total };
  },

  // ── Public read ──────────────────────────────────────────
  async listPublished(args: {
    where: Prisma.ArticleWhereInput;
    skip: number;
    take: number;
  }) {
    const [rows, total] = await Promise.all([
      prisma.article.findMany({
        where: publishedWhere(args.where),
        orderBy: { publishedAt: "desc" },
        skip: args.skip,
        take: args.take,
        select: publicArticleCardSelect,
      }),
      prisma.article.count({ where: publishedWhere(args.where) }),
    ]);
    return { rows, total };
  },

  findPublishedBySlug(slug: string) {
    return prisma.article.findFirst({
      where: publishedWhere({ slug }),
      select: publicArticleSelect,
    });
  },

  /** Related published articles sharing the primary category, excluding self. */
  relatedPublished(articleId: string, primaryCategoryId: string | null, take: number) {
    return prisma.article.findMany({
      where: publishedWhere({
        id: { not: articleId },
        ...(primaryCategoryId ? { primaryCategoryId } : {}),
      }),
      orderBy: { publishedAt: "desc" },
      take,
      select: publicArticleCardSelect,
    });
  },
};
