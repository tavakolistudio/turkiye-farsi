import "server-only";
import { createHash } from "node:crypto";
import { Prisma, type ContentType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { articleRepo, publicArticleCardSelect, publishedWhere } from "@/server/data/article.repo";
import { ApiError } from "@/lib/api/errors";
import { isBotUserAgent, relatedArticleScore, VIEW_DEDUPLICATION_MS } from "@/lib/public-content";

type PageQuery = { page: number; pageSize: number };
type NewsQuery = PageQuery & {
  category?: string;
  contentType?: ContentType;
  sort?: "latest" | "oldest" | "most-viewed";
  q?: string;
  search?: string;
  order?: "asc" | "desc";
  includeDeleted?: boolean;
};
type SearchQuery = PageQuery & {
  q: string;
  category?: string;
  from?: Date;
  to?: Date;
  sort: "relevance" | "latest";
};

const page = ({ page: current, pageSize }: PageQuery, total: number) => ({
  page: current,
  pageSize,
  total,
  totalPages: Math.max(1, Math.ceil(total / pageSize)),
});

const skipTake = ({ page: current, pageSize }: PageQuery) => ({
  skip: (current - 1) * pageSize,
  take: pageSize,
});

function publicNow() {
  return new Date();
}

export const publicContentService = {
  async listArticles(query: NewsQuery) {
    const where: Prisma.ArticleWhereInput = {
      ...(query.category ? { primaryCategory: { slug: query.category, deletedAt: null } } : {}),
      ...(query.contentType ? { contentType: query.contentType } : {}),
      ...((query.q || query.search) ? {
        OR: [
          { title: { contains: query.q || query.search, mode: "insensitive" } },
          { subtitle: { contains: query.q || query.search, mode: "insensitive" } },
          { summary: { contains: query.q || query.search, mode: "insensitive" } },
        ],
      } : {}),
    };
    const orderBy: Prisma.ArticleOrderByWithRelationInput = query.sort === "oldest"
      ? { publishedAt: "asc" }
      : query.sort === "most-viewed"
        ? { viewCount: "desc" }
        : { publishedAt: "desc" };
    const [rows, total] = await Promise.all([
      prisma.article.findMany({ where: publishedWhere(where), orderBy, ...skipTake(query), select: publicArticleCardSelect }),
      prisma.article.count({ where: publishedWhere(where) }),
    ]);
    return { rows, meta: page(query, total) };
  },

  async getArticleBySlug(slug: string) {
    const article = await articleRepo.findPublishedBySlug(slug);
    if (!article) throw ApiError.notFound("مطلب یافت نشد.");
    return article;
  },

  async getArticleNavigation(articleId: string, publishedAt: Date) {
    const [previous, next] = await Promise.all([
      prisma.article.findFirst({
        where: publishedWhere({ id: { not: articleId }, publishedAt: { lt: publishedAt } }),
        orderBy: { publishedAt: "desc" },
        select: { title: true, slug: true },
      }),
      prisma.article.findFirst({
        where: publishedWhere({ id: { not: articleId }, publishedAt: { gt: publishedAt } }),
        orderBy: { publishedAt: "asc" },
        select: { title: true, slug: true },
      }),
    ]);
    return { previous, next };
  },

  async getRelated(slug: string, take = 6) {
    const article = await prisma.article.findFirst({
      where: publishedWhere({ slug }),
      select: { id: true, primaryCategoryId: true, primaryCategory: { select: { slug: true } }, tags: { select: { tagId: true } } },
    });
    if (!article) throw ApiError.notFound("مطلب یافت نشد.");
    const tagIds = article.tags.map((item) => item.tagId);
    const candidates = await prisma.article.findMany({
      where: publishedWhere({
        id: { not: article.id },
        OR: [
          ...(article.primaryCategoryId ? [{ primaryCategoryId: article.primaryCategoryId }] : []),
          ...(tagIds.length ? [{ tags: { some: { tagId: { in: tagIds } } } }] : []),
        ],
      }),
      orderBy: { publishedAt: "desc" },
      take: Math.min(40, take * 5),
      select: { ...publicArticleCardSelect, tags: { select: { tagId: true, tag: { select: { name: true, slug: true } } } } },
    });
    return candidates
      .map((candidate) => ({
        candidate,
        score: relatedArticleScore({
          sameCategory: candidate.primaryCategory?.slug === article.primaryCategory?.slug,
          sharedTags: candidate.tags.filter((item) => tagIds.includes(item.tagId)).length,
          publishedAt: candidate.publishedAt,
        }),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, take)
      .map(({ candidate }) => candidate);
  },

  async listCategories() {
    return prisma.category.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: [{ order: "asc" }, { name: "asc" }],
      select: {
        id: true, name: true, slug: true, description: true, parentId: true,
        image: { select: { publicUrl: true, alt: true, width: true, height: true } },
        children: { where: { deletedAt: null, isActive: true }, orderBy: { order: "asc" }, select: { name: true, slug: true } },
        _count: { select: { primaryArticles: { where: publishedWhere() } } },
      },
    });
  },

  async getCategory(slug: string) {
    const category = await prisma.category.findFirst({
      where: { slug, deletedAt: null, isActive: true },
      select: {
        id: true, name: true, slug: true, description: true,
        image: { select: { publicUrl: true, alt: true, width: true, height: true } },
        parent: { select: { name: true, slug: true } },
        children: { where: { deletedAt: null, isActive: true }, orderBy: { order: "asc" }, select: { name: true, slug: true } },
      },
    });
    if (!category) throw ApiError.notFound("دسته‌بندی یافت نشد.");
    return category;
  },

  async listTags() {
    return prisma.tag.findMany({
      where: { deletedAt: null }, orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, description: true, _count: { select: { articles: { where: { article: publishedWhere() } } } } },
    });
  },

  async getTag(slug: string) {
    const tag = await prisma.tag.findFirst({ where: { slug, deletedAt: null }, select: { id: true, name: true, slug: true, description: true } });
    if (!tag) throw ApiError.notFound("برچسب یافت نشد.");
    return tag;
  },

  async articlesByCategory(categorySlug: string, query: PageQuery) {
    const category = await this.getCategory(categorySlug);
    const where = { primaryCategoryId: category.id };
    const [rows, total] = await Promise.all([
      prisma.article.findMany({ where: publishedWhere(where), orderBy: { publishedAt: "desc" }, ...skipTake(query), select: publicArticleCardSelect }),
      prisma.article.count({ where: publishedWhere(where) }),
    ]);
    return { rows, meta: page(query, total), category };
  },

  async articlesByTag(tagSlug: string, query: PageQuery) {
    const tag = await this.getTag(tagSlug);
    const where = { tags: { some: { tagId: tag.id } } };
    const [rows, total] = await Promise.all([
      prisma.article.findMany({ where: publishedWhere(where), orderBy: { publishedAt: "desc" }, ...skipTake(query), select: publicArticleCardSelect }),
      prisma.article.count({ where: publishedWhere(where) }),
    ]);
    return { rows, meta: page(query, total), tag };
  },

  async getAuthor(slug: string) {
    const author = await prisma.profile.findFirst({
      where: { slug, isPublic: true, user: { isActive: true, deletedAt: null } },
      select: {
        userId: true, displayName: true, slug: true, avatarUrl: true, bio: true, expertise: true,
        twitter: true, instagram: true, telegram: true, linkedin: true, website: true,
        user: { select: { name: true, _count: { select: { articles: { where: publishedWhere() } } } } },
      },
    });
    if (!author) throw ApiError.notFound("نویسنده یافت نشد.");
    return author;
  },

  async articlesByAuthor(slug: string, query: PageQuery) {
    const author = await this.getAuthor(slug);
    const where = { authorId: author.userId };
    const [rows, total] = await Promise.all([
      prisma.article.findMany({ where: publishedWhere(where), orderBy: { publishedAt: "desc" }, ...skipTake(query), select: publicArticleCardSelect }),
      prisma.article.count({ where: publishedWhere(where) }),
    ]);
    return { rows, meta: page(query, total), author };
  },

  async listBreaking(query: PageQuery) {
    const where = { isBreaking: true };
    const [rows, total] = await Promise.all([
      prisma.article.findMany({ where: publishedWhere(where), orderBy: [{ priority: "desc" }, { publishedAt: "desc" }], ...skipTake(query), select: publicArticleCardSelect }),
      prisma.article.count({ where: publishedWhere(where) }),
    ]);
    return { rows, meta: page(query, total) };
  },

  async breakingBar() {
    const now = publicNow();
    const [manual, articles] = await Promise.all([
      prisma.breakingNews.findMany({
        where: { isActive: true, AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gt: now } }] }] },
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }], take: 5,
        select: { id: true, title: true, url: true, articleId: true, createdAt: true },
      }),
      prisma.article.findMany({ where: publishedWhere({ isBreaking: true }), orderBy: { publishedAt: "desc" }, take: 5, select: { id: true, title: true, slug: true, publishedAt: true } }),
    ]);
    const linked = await prisma.article.findMany({
      where: publishedWhere({ id: { in: manual.map((item) => item.articleId).filter((id): id is string => Boolean(id)) } }),
      select: { id: true, slug: true },
    });
    const slugs = new Map(linked.map((item) => [item.id, item.slug]));
    const safeHref = (value: string | null) => value && (value.startsWith("/") || /^https:\/\//i.test(value)) ? value : null;
    return [
      ...manual.map((item) => ({ id: `manual-${item.id}`, title: item.title, href: safeHref(item.url) ?? (item.articleId && slugs.has(item.articleId) ? `/news/${slugs.get(item.articleId)}` : null), at: item.createdAt })),
      ...articles.map((item) => ({ id: `article-${item.id}`, title: item.title, href: `/news/${item.slug}`, at: item.publishedAt })),
    ].filter((item) => item.href).slice(0, 6);
  },

  async mostViewed(range: "today" | "week" | "month" | "all", query: PageQuery) {
    const days = range === "today" ? 1 : range === "week" ? 7 : range === "month" ? 30 : null;
    const createdAt = days ? { gte: new Date(Date.now() - days * 86_400_000) } : undefined;
    const groups = await prisma.pageView.groupBy({
      by: ["articleId"], where: { articleId: { not: null }, ...(createdAt ? { createdAt } : {}) },
      _count: { articleId: true }, orderBy: { _count: { articleId: "desc" } },
      skip: (query.page - 1) * query.pageSize, take: query.pageSize,
    });
    const ids = groups.map((group) => group.articleId).filter((id): id is string => Boolean(id));
    const articles = await prisma.article.findMany({ where: publishedWhere({ id: { in: ids } }), select: publicArticleCardSelect });
    const byId = new Map(articles.map((article) => [article.id, article]));
    const rows = groups.flatMap((group) => {
      const article = group.articleId ? byId.get(group.articleId) : undefined;
      return article ? [{ ...article, rangeViews: group._count.articleId }] : [];
    });
    const total = await prisma.article.count({ where: publishedWhere({ pageViews: { some: createdAt ? { createdAt } : {} } }) });
    return { rows, meta: page(query, total) };
  },

  async search(query: SearchQuery) {
    const term = query.q.trim();
    const pattern = `%${term.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
    const conditions: Prisma.Sql[] = [
      Prisma.sql`a.status = 'PUBLISHED'`,
      Prisma.sql`a."deletedAt" IS NULL`,
      Prisma.sql`a."publishedAt" IS NOT NULL AND a."publishedAt" <= NOW()`,
      Prisma.sql`(
        a.title ILIKE ${pattern} OR COALESCE(a.subtitle, '') ILIKE ${pattern} OR COALESCE(a.summary, '') ILIKE ${pattern}
        OR COALESCE(a."bodyJson"::text, '') ILIKE ${pattern}
        OR EXISTS (SELECT 1 FROM categories c WHERE c.id = a."primaryCategoryId" AND c.name ILIKE ${pattern})
        OR EXISTS (SELECT 1 FROM article_tags atg JOIN tags t ON t.id = atg."tagId" WHERE atg."articleId" = a.id AND t.name ILIKE ${pattern})
        OR EXISTS (SELECT 1 FROM users u LEFT JOIN profiles p ON p."userId" = u.id WHERE u.id = a."authorId" AND (u.name ILIKE ${pattern} OR COALESCE(p."displayName", '') ILIKE ${pattern}))
      )`,
      ...(query.category ? [Prisma.sql`EXISTS (SELECT 1 FROM categories c WHERE c.id = a."primaryCategoryId" AND c.slug = ${query.category})`] : []),
      ...(query.from ? [Prisma.sql`a."publishedAt" >= ${query.from}`] : []),
      ...(query.to ? [Prisma.sql`a."publishedAt" <= ${query.to}`] : []),
    ];
    const whereSql = Prisma.join(conditions, " AND ");
    const rankSql = Prisma.sql`(
      CASE WHEN a.title ILIKE ${pattern} THEN 8 ELSE 0 END
      + CASE WHEN COALESCE(a.subtitle, '') ILIKE ${pattern} THEN 4 ELSE 0 END
      + CASE WHEN COALESCE(a.summary, '') ILIKE ${pattern} THEN 2 ELSE 0 END
      + CASE WHEN COALESCE(a."bodyJson"::text, '') ILIKE ${pattern} THEN 1 ELSE 0 END
    )`;
    const orderSql = query.sort === "latest" ? Prisma.sql`a."publishedAt" DESC` : Prisma.sql`${rankSql} DESC, a."publishedAt" DESC`;
    const offset = (query.page - 1) * query.pageSize;
    const [matches, countRows] = await Promise.all([
      prisma.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT a.id FROM articles a WHERE ${whereSql} ORDER BY ${orderSql} LIMIT ${query.pageSize} OFFSET ${offset}`),
      prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`SELECT COUNT(*)::bigint AS count FROM articles a WHERE ${whereSql}`),
    ]);
    const ids = matches.map((match) => match.id);
    const articles = await prisma.article.findMany({ where: publishedWhere({ id: { in: ids } }), select: publicArticleCardSelect });
    const byId = new Map(articles.map((article) => [article.id, article]));
    const rows = ids.flatMap((id) => byId.get(id) ?? []);
    const total = Number(countRows[0]?.count ?? 0);
    await prisma.searchLog.create({ data: { query: term, resultCount: total } });
    return { rows, meta: page(query, total) };
  },

  async recordView(input: { articleId: string; sessionKey: string; path: string; referrer?: string | null; userAgent?: string | null }) {
    if (isBotUserAgent(input.userAgent)) return { counted: false };
    const article = await prisma.article.findFirst({ where: publishedWhere({ id: input.articleId }), select: { id: true } });
    if (!article) throw ApiError.notFound("مطلب یافت نشد.");
    const sessionKey = createHash("sha256").update(input.sessionKey).digest("hex");
    const recent = await prisma.pageView.findFirst({
      where: { articleId: article.id, sessionKey, createdAt: { gte: new Date(Date.now() - VIEW_DEDUPLICATION_MS) } }, select: { id: true },
    });
    if (recent) return { counted: false };
    await prisma.$transaction([
      prisma.pageView.create({ data: { articleId: article.id, path: input.path.slice(0, 500), referrer: input.referrer?.slice(0, 500), sessionKey } }),
      prisma.article.update({ where: { id: article.id }, data: { viewCount: { increment: 1 } } }),
    ]);
    return { counted: true };
  },

  async getSiteChrome() {
    const [categories, settings, breaking] = await Promise.all([
      prisma.category.findMany({ where: { deletedAt: null, isActive: true, parentId: null }, orderBy: { order: "asc" }, take: 8, select: { name: true, slug: true } }),
      prisma.siteSetting.findMany({ where: { key: { in: ["general", "footer"] } }, select: { key: true, value: true } }),
      this.breakingBar(),
    ]);
    return { categories, settings: Object.fromEntries(settings.map((item) => [item.key, item.value])), breaking };
  },

  async getStaticPage(slug: string) {
    return prisma.siteSetting.findUnique({ where: { key: `page:${slug}` }, select: { value: true } });
  },

  async homepage() {
    const [sections, hero, latest, breaking, editors, viewed, guides, turkey, yalova, ads] = await Promise.all([
      prisma.homeSection.findMany({ where: { isEnabled: true, type: { not: "NEWSLETTER" } }, orderBy: { order: "asc" }, select: { id: true, type: true, title: true, itemCount: true, categoryId: true } }),
      prisma.article.findMany({ where: publishedWhere({ isHero: true }), orderBy: [{ priority: "desc" }, { publishedAt: "desc" }], take: 5, select: publicArticleCardSelect }),
      prisma.article.findMany({ where: publishedWhere(), orderBy: { publishedAt: "desc" }, take: 12, select: publicArticleCardSelect }),
      prisma.article.findMany({ where: publishedWhere({ isBreaking: true }), orderBy: { publishedAt: "desc" }, take: 6, select: publicArticleCardSelect }),
      prisma.article.findMany({ where: publishedWhere({ isEditorsPick: true }), orderBy: { publishedAt: "desc" }, take: 6, select: publicArticleCardSelect }),
      prisma.article.findMany({ where: publishedWhere(), orderBy: { viewCount: "desc" }, take: 6, select: publicArticleCardSelect }),
      prisma.article.findMany({ where: publishedWhere({ contentType: "GUIDE" }), orderBy: { publishedAt: "desc" }, take: 6, select: publicArticleCardSelect }),
      prisma.article.findMany({ where: publishedWhere({ primaryCategory: { name: { contains: "ترکیه", mode: "insensitive" } } }), orderBy: { publishedAt: "desc" }, take: 6, select: publicArticleCardSelect }),
      prisma.article.findMany({ where: publishedWhere({ primaryCategory: { name: { contains: "یالووا", mode: "insensitive" } } }), orderBy: { publishedAt: "desc" }, take: 6, select: publicArticleCardSelect }),
      prisma.advertisement.findMany({ where: { status: "ACTIVE", placement: "HOMEPAGE", AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: publicNow() } }] }, { OR: [{ endsAt: null }, { endsAt: { gt: publicNow() } }] }] }, take: 2, select: { id: true, name: true, imageUrl: true, linkUrl: true } }),
    ]);
    const categorySections = await Promise.all(sections.filter((section) => section.categoryId).map(async (section) => ({
      ...section,
      articles: await prisma.article.findMany({ where: publishedWhere({ primaryCategoryId: section.categoryId }), orderBy: { publishedAt: "desc" }, take: Math.min(section.itemCount, 8), select: publicArticleCardSelect }),
    })));
    return { hero, latest, breaking, editors, viewed, guides, turkey, yalova, ads, categorySections };
  },
};
