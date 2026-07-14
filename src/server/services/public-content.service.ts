import "server-only";
import { prisma } from "@/lib/db";
import { articleRepo, publicArticleSelect, publishedWhere } from "@/server/data/article.repo";
import { paginationArgs, paginationMeta, type ListQuery } from "@/lib/api/pagination";
import { ApiError } from "@/lib/api/errors";

/**
 * Read-only content API for external consumers (website, mobile, bot, agents).
 * Returns ONLY published, non-deleted articles and never exposes internal or
 * editorial-only fields (enforced by `publicArticleSelect`).
 */
export const publicContentService = {
  async listArticles(query: ListQuery) {
    const where = query.search
      ? {
          OR: [
            { title: { contains: query.search, mode: "insensitive" as const } },
            { summary: { contains: query.search, mode: "insensitive" as const } },
          ],
        }
      : {};
    const { rows, total } = await articleRepo.listPublished({ where, ...paginationArgs(query) });
    return { rows, meta: paginationMeta(query, total) };
  },

  async getArticleBySlug(slug: string) {
    const article = await articleRepo.findPublishedBySlug(slug);
    if (!article) throw ApiError.notFound("مطلب یافت نشد.");
    return article;
  },

  async getRelated(slug: string, take = 6) {
    const article = await prisma.article.findFirst({
      where: publishedWhere({ slug }),
      select: { id: true, primaryCategoryId: true },
    });
    if (!article) throw ApiError.notFound("مطلب یافت نشد.");
    return articleRepo.relatedPublished(article.id, article.primaryCategoryId, take);
  },

  async listCategories() {
    return prisma.category.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: { order: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        parentId: true,
        _count: { select: { primaryArticles: { where: publishedWhere() } } },
      },
    });
  },

  async listTags() {
    return prisma.tag.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true },
    });
  },

  async articlesByCategory(categorySlug: string, query: ListQuery) {
    const category = await prisma.category.findFirst({
      where: { slug: categorySlug, deletedAt: null },
      select: { id: true },
    });
    if (!category) throw ApiError.notFound("دسته‌بندی یافت نشد.");
    const { rows, total } = await articleRepo.listPublished({
      where: { primaryCategoryId: category.id },
      ...paginationArgs(query),
    });
    return { rows, meta: paginationMeta(query, total) };
  },

  async articlesByTag(tagSlug: string, query: ListQuery) {
    const tag = await prisma.tag.findFirst({
      where: { slug: tagSlug, deletedAt: null },
      select: { id: true },
    });
    if (!tag) throw ApiError.notFound("برچسب یافت نشد.");
    const rows = await prisma.article.findMany({
      where: publishedWhere({ tags: { some: { tagId: tag.id } } }),
      orderBy: { publishedAt: "desc" },
      ...paginationArgs(query),
      select: publicArticleSelect,
    });
    const total = await prisma.article.count({
      where: publishedWhere({ tags: { some: { tagId: tag.id } } }),
    });
    return { rows, meta: paginationMeta(query, total) };
  },
};
