import "server-only";
import type { Prisma, ArticleStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { articleRepo, adminArticleInclude } from "@/server/data/article.repo";
import { auditLog } from "@/server/audit/log";
import { assertPermission, hasPermission } from "@/server/rbac/authz";
import { PERMISSIONS } from "@/server/rbac/permissions";
import { ApiError } from "@/lib/api/errors";
import { generateUniqueSlug } from "@/lib/slug";
import { sanitizeBodyJson } from "@/lib/editorial/content";
import { readingTimeService } from "./reading-time.service";
import {
  createArticleSchema,
  updateArticleSchema,
  type CreateArticleInput,
  type UpdateArticleInput,
} from "@/lib/validations/article";
import { buildOrderBy, paginationArgs, paginationMeta, type ListQuery } from "@/lib/api/pagination";
import type { ServiceContext } from "./context";
import { registerRedirect } from "./redirect.service";

const SORTABLE = ["createdAt", "updatedAt", "publishedAt", "title", "priority", "viewCount"] as const;

/** Ensure all referenced ids exist (prevents broken relations). */
async function assertRelationsExist(input: Partial<CreateArticleInput>) {
  if (input.authorId) {
    const u = await prisma.user.count({ where: { id: input.authorId, deletedAt: null } });
    if (!u) throw ApiError.validation("نویسنده معتبر نیست.");
  }
  if (input.primaryCategoryId) {
    const c = await prisma.category.count({ where: { id: input.primaryCategoryId, deletedAt: null } });
    if (!c) throw ApiError.validation("دسته‌بندی اصلی معتبر نیست.");
  }
  if (input.categoryIds?.length) {
    const n = await prisma.category.count({ where: { id: { in: input.categoryIds }, deletedAt: null } });
    if (n !== new Set(input.categoryIds).size) throw ApiError.validation("یک یا چند دسته‌بندی معتبر نیست.");
  }
  if (input.tagIds?.length) {
    const n = await prisma.tag.count({ where: { id: { in: input.tagIds }, deletedAt: null } });
    if (n !== new Set(input.tagIds).size) throw ApiError.validation("یک یا چند برچسب معتبر نیست.");
  }
  for (const [field, id, label] of [
    ["featuredImageId", input.featuredImageId, "تصویر شاخص"],
    ["ogImageId", input.ogImageId, "تصویر Open Graph"],
  ] as const) {
    if (id) {
      const m = await prisma.media.count({ where: { id, deletedAt: null } });
      if (!m) throw ApiError.validation(`${label} معتبر نیست.`);
      void field;
    }
  }
}

/** Build ArticleCategory join rows from primary + secondary category ids. */
function categoryLinks(primaryId: string | undefined, secondary: string[] | undefined) {
  const links: Prisma.ArticleCategoryCreateWithoutArticleInput[] = [];
  let order = 0;
  if (primaryId) links.push({ category: { connect: { id: primaryId } }, isPrimary: true, order: order++ });
  for (const cid of secondary ?? []) {
    if (cid === primaryId) continue;
    links.push({ category: { connect: { id: cid } }, isPrimary: false, order: order++ });
  }
  return links;
}

/** Map validated input to Article scalar fields (whitelist — no mass assignment). */
function scalarData(input: Partial<CreateArticleInput>): Prisma.ArticleUpdateInput {
  const d: Prisma.ArticleUpdateInput = {};
  const assign = <K extends keyof CreateArticleInput>(k: K) => {
    if (input[k] !== undefined) (d as Record<string, unknown>)[k] = input[k];
  };
  (
    [
      "title", "subtitle", "summary", "contentType", "priority",
      "isBreaking", "isEditorsPick", "isHero", "isFeatured", "commentsEnabled",
      "whyItMatters", "whoIsAffected", "whatToDo", "factCheckStatus", "changeWarning",
      "sourceStatus", "metaTitle", "metaDescription", "canonicalUrl", "noindex",
      "instagramCaption", "telegramCaption", "reelTitle", "carouselTitle", "pushTitle", "pushBody",
    ] as const
  ).forEach(assign);
  if (input.bodyJson !== undefined) d.bodyJson = sanitizeBodyJson(input.bodyJson);
  return d;
}

export const articleService = {
  async list(ctx: ServiceContext, query: ListQuery & { status?: string; authorId?: string; categoryId?: string }) {
    assertPermission(ctx.actor, PERMISSIONS.ARTICLE_VIEW);
    const where: Prisma.ArticleWhereInput = {
      ...(query.includeDeleted ? {} : { deletedAt: null }),
      ...(query.status ? { status: query.status as ArticleStatus } : {}),
      ...(query.authorId ? { authorId: query.authorId } : {}),
      ...(query.categoryId ? { primaryCategoryId: query.categoryId } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: "insensitive" } },
              { summary: { contains: query.search, mode: "insensitive" } },
              { slug: { contains: query.search } },
            ],
          }
        : {}),
    };
    const orderBy = buildOrderBy(query.sort, query.order, SORTABLE, "createdAt");
    const { rows, total } = await articleRepo.list({ where, orderBy, ...paginationArgs(query) });
    return { rows, meta: paginationMeta(query, total) };
  },

  async getById(ctx: ServiceContext, id: string) {
    assertPermission(ctx.actor, PERMISSIONS.ARTICLE_VIEW);
    const a = await articleRepo.findById(id);
    if (!a) throw ApiError.notFound("مطلب یافت نشد.");
    return a;
  },

  async create(ctx: ServiceContext, raw: unknown) {
    assertPermission(ctx.actor, PERMISSIONS.ARTICLE_CREATE);
    const input = createArticleSchema.parse(raw);
    const authorId = input.authorId ?? ctx.actor.id;
    await assertRelationsExist({ ...input, authorId });

    const slug = await generateUniqueSlug(input.slug ?? input.title, (s) => articleRepo.slugExists(s));
    const sanitizedBody = input.bodyJson ? sanitizeBodyJson(input.bodyJson) : undefined;
    const readingTime = sanitizedBody ? readingTimeService.calculate(sanitizedBody).minutes : null;

    const links = categoryLinks(input.primaryCategoryId, input.categoryIds);
    const tagLinks = (input.tagIds ?? []).map((id) => ({ tag: { connect: { id } } }));

    const created = await prisma.article.create({
      data: {
        ...(scalarData({ ...input, bodyJson: sanitizedBody }) as Prisma.ArticleCreateInput),
        title: input.title,
        slug,
        status: "DRAFT",
        readingTime,
        publishedAt: null,
        author: { connect: { id: authorId } },
        ...(input.primaryCategoryId ? { primaryCategory: { connect: { id: input.primaryCategoryId } } } : {}),
        ...(input.featuredImageId ? { featuredImage: { connect: { id: input.featuredImageId } } } : {}),
        ...(input.ogImageId ? { ogImage: { connect: { id: input.ogImageId } } } : {}),
        ...(links.length ? { categories: { create: links } } : {}),
        ...(tagLinks.length ? { tags: { create: tagLinks } } : {}),
      },
      include: adminArticleInclude,
    });

    await auditLog({
      userId: ctx.actor.id,
      action: "article.create",
      entityType: "article",
      entityId: created.id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      after: { title: created.title, slug: created.slug, status: created.status },
    });
    return created;
  },

  async update(ctx: ServiceContext, id: string, raw: unknown) {
    const input: UpdateArticleInput = updateArticleSchema.parse(raw);
    const existing = await articleRepo.findByIdBasic(id);
    if (!existing) throw ApiError.notFound("مطلب یافت نشد.");

    // Ownership-aware authorization.
    const canAny = hasPermission(ctx.actor, PERMISSIONS.ARTICLE_UPDATE_ANY);
    const canOwn = hasPermission(ctx.actor, PERMISSIONS.ARTICLE_UPDATE_OWN) && existing.authorId === ctx.actor.id;
    if (!canAny && !canOwn) throw ApiError.forbidden();

    await assertRelationsExist(input);

    // Published slugs may change because the old URL is preserved atomically.
    let slug = existing.slug;
    if (input.slug && input.slug !== existing.slug) {
      slug = await generateUniqueSlug(input.slug, (s) => articleRepo.slugExists(s, id));
    }

    if (existing.currentVersion !== input.version) throw ApiError.versionConflict(existing.currentVersion);
    const sanitizedBody = input.bodyJson !== undefined ? sanitizeBodyJson(input.bodyJson) : undefined;
    const readingTime = sanitizedBody !== undefined
      ? readingTimeService.calculate(sanitizedBody).minutes
      : existing.readingTime;

    const scalar: Prisma.ArticleUpdateManyMutationInput = {
      ...(scalarData({ ...input, bodyJson: sanitizedBody }) as Prisma.ArticleUpdateManyMutationInput),
      slug,
      readingTime,
      currentVersion: { increment: 1 },
    };

    const updated = await prisma.$transaction(async (tx) => {
      const claimed = await tx.article.updateMany({
        where: { id, currentVersion: input.version },
        data: scalar,
      });
      if (!claimed.count) throw ApiError.versionConflict(input.version + 1);
      if (input.categoryIds !== undefined || input.primaryCategoryId !== undefined) {
        await tx.articleCategory.deleteMany({ where: { articleId: id } });
        const links = categoryLinks(
          input.primaryCategoryId ?? existing.primaryCategoryId ?? undefined,
          input.categoryIds,
        );
        for (const l of links) {
          await tx.articleCategory.create({ data: { ...l, article: { connect: { id } } } });
        }
      }
      if (input.tagIds !== undefined) {
        await tx.articleTag.deleteMany({ where: { articleId: id } });
        for (const tagId of input.tagIds) {
          await tx.articleTag.create({ data: { article: { connect: { id } }, tag: { connect: { id: tagId } } } });
        }
      }
      if (existing.publishedAt && slug !== existing.slug) {
        await registerRedirect(tx, `/news/${existing.slug}`, `/news/${slug}`);
      }
      return tx.article.update({
        where: { id },
        data: {
          ...(input.authorId ? { author: { connect: { id: input.authorId } } } : {}),
          ...(input.primaryCategoryId !== undefined
            ? { primaryCategory: input.primaryCategoryId ? { connect: { id: input.primaryCategoryId } } : { disconnect: true } }
            : {}),
          ...(input.featuredImageId !== undefined
            ? { featuredImage: input.featuredImageId ? { connect: { id: input.featuredImageId } } : { disconnect: true } }
            : {}),
          ...(input.ogImageId !== undefined
            ? { ogImage: input.ogImageId ? { connect: { id: input.ogImageId } } : { disconnect: true } }
            : {}),
        },
        include: adminArticleInclude,
      });
    });

    await auditLog({
      userId: ctx.actor.id,
      action: "article.update",
      entityType: "article",
      entityId: id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      before: { title: existing.title, status: existing.status, slug: existing.slug },
      after: { title: updated.title, status: updated.status, slug: updated.slug },
    });
    return updated;
  },

  async softDelete(ctx: ServiceContext, id: string) {
    assertPermission(ctx.actor, PERMISSIONS.ARTICLE_DELETE);
    const existing = await articleRepo.findByIdBasic(id);
    if (!existing) throw ApiError.notFound("مطلب یافت نشد.");
    const deleted = await prisma.article.update({ where: { id }, data: { deletedAt: new Date() } });
    await auditLog({
      userId: ctx.actor.id,
      action: "article.delete",
      entityType: "article",
      entityId: id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      before: { title: existing.title },
    });
    return deleted;
  },

  async restore(ctx: ServiceContext, id: string) {
    assertPermission(ctx.actor, PERMISSIONS.ARTICLE_RESTORE);
    const existing = await articleRepo.findByIdBasic(id);
    if (!existing) throw ApiError.notFound("مطلب یافت نشد.");
    const restored = await prisma.article.update({ where: { id }, data: { deletedAt: null } });
    await auditLog({
      userId: ctx.actor.id,
      action: "article.restore",
      entityType: "article",
      entityId: id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    return restored;
  },
};
