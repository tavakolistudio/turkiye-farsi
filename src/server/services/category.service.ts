import "server-only";
import type { Prisma } from "@prisma/client";
import { categoryRepo } from "@/server/data/category.repo";
import { auditLog } from "@/server/audit/log";
import { assertPermission } from "@/server/rbac/authz";
import { PERMISSIONS } from "@/server/rbac/permissions";
import { ApiError } from "@/lib/api/errors";
import { generateUniqueSlug } from "@/lib/slug";
import { createCategorySchema, updateCategorySchema } from "@/lib/validations/category";
import {
  buildOrderBy,
  paginationArgs,
  paginationMeta,
  type ListQuery,
} from "@/lib/api/pagination";
import type { ServiceContext } from "./context";
import { prisma } from "@/lib/db";
import { registerRedirect } from "./redirect.service";

const SORTABLE = ["order", "name", "createdAt", "updatedAt"] as const;

/** True if setting `newParentId` as parent of `categoryId` forms a cycle. */
function wouldCreateCycle(
  parentMap: Map<string, string | null>,
  categoryId: string,
  newParentId: string,
): boolean {
  if (newParentId === categoryId) return true;
  let current: string | null | undefined = newParentId;
  const seen = new Set<string>();
  while (current) {
    if (current === categoryId) return true;
    if (seen.has(current)) break; // pre-existing cycle guard
    seen.add(current);
    current = parentMap.get(current);
  }
  return false;
}

export const categoryService = {
  async list(ctx: ServiceContext, query: ListQuery) {
    assertPermission(ctx.actor, PERMISSIONS.CATEGORY_VIEW);
    const where: Prisma.CategoryWhereInput = {
      ...(query.includeDeleted ? {} : { deletedAt: null }),
      ...(query.search
        ? { OR: [{ name: { contains: query.search, mode: "insensitive" } }, { slug: { contains: query.search } }] }
        : {}),
    };
    const orderBy = buildOrderBy(query.sort, query.order, SORTABLE, "order");
    const { rows, total } = await categoryRepo.list({ where, orderBy, ...paginationArgs(query) });
    return { rows, meta: paginationMeta(query, total) };
  },

  async getById(ctx: ServiceContext, id: string) {
    assertPermission(ctx.actor, PERMISSIONS.CATEGORY_VIEW);
    const cat = await categoryRepo.findById(id, true);
    if (!cat) throw ApiError.notFound("دسته‌بندی یافت نشد.");
    return cat;
  },

  async create(ctx: ServiceContext, raw: unknown) {
    assertPermission(ctx.actor, PERMISSIONS.CATEGORY_CREATE);
    const input = createCategorySchema.parse(raw);

    if (input.parentId && !(await categoryRepo.findById(input.parentId))) {
      throw ApiError.validation("دسته‌بندی والد معتبر نیست.");
    }

    const slug = await generateUniqueSlug(input.slug ?? input.name, (s) =>
      categoryRepo.slugExists(s),
    );

    const data: Prisma.CategoryCreateInput = {
      name: input.name,
      slug,
      description: input.description,
      order: input.order,
      isActive: input.isActive,
      metaTitle: input.metaTitle,
      metaDescription: input.metaDescription,
      ...(input.parentId ? { parent: { connect: { id: input.parentId } } } : {}),
      ...(input.imageId ? { image: { connect: { id: input.imageId } } } : {}),
    };
    const created = await categoryRepo.create(data);
    await auditLog({
      userId: ctx.actor.id,
      action: "category.create",
      entityType: "category",
      entityId: created.id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      after: { name: created.name, slug: created.slug },
    });
    return created;
  },

  async update(ctx: ServiceContext, id: string, raw: unknown) {
    assertPermission(ctx.actor, PERMISSIONS.CATEGORY_UPDATE);
    const input = updateCategorySchema.parse(raw);
    const existing = await categoryRepo.findById(id, true);
    if (!existing) throw ApiError.notFound("دسته‌بندی یافت نشد.");

    if (input.parentId) {
      if (!(await categoryRepo.findById(input.parentId))) {
        throw ApiError.validation("دسته‌بندی والد معتبر نیست.");
      }
      const map = await categoryRepo.parentMap();
      if (wouldCreateCycle(map, id, input.parentId)) {
        throw new ApiError("CIRCULAR_REFERENCE", "این انتخاب باعث ایجاد حلقه در دسته‌بندی‌ها می‌شود.");
      }
    }

    let slug = existing.slug;
    if (input.slug && input.slug !== existing.slug) {
      slug = await generateUniqueSlug(input.slug, (s) => categoryRepo.slugExists(s, id));
    }

    const data: Prisma.CategoryUpdateInput = {
      ...(input.name !== undefined ? { name: input.name } : {}),
      slug,
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.order !== undefined ? { order: input.order } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.metaTitle !== undefined ? { metaTitle: input.metaTitle } : {}),
      ...(input.metaDescription !== undefined ? { metaDescription: input.metaDescription } : {}),
      ...(input.parentId !== undefined
        ? { parent: input.parentId ? { connect: { id: input.parentId } } : { disconnect: true } }
        : {}),
      ...(input.imageId !== undefined
        ? { image: input.imageId ? { connect: { id: input.imageId } } : { disconnect: true } }
        : {}),
    };
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.category.update({ where: { id }, data });
      if (slug !== existing.slug) {
        await registerRedirect(tx, `/category/${existing.slug}`, `/category/${slug}`);
      }
      return row;
    });
    await auditLog({
      userId: ctx.actor.id,
      action: "category.update",
      entityType: "category",
      entityId: id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      before: { name: existing.name, slug: existing.slug },
      after: { name: updated.name, slug: updated.slug },
    });
    return updated;
  },

  /**
   * Soft-delete a category. If it still has articles, refuses unless a
   * `reassignToCategoryId` is given, in which case those articles are moved
   * first (never hard-deletes content).
   */
  async softDelete(ctx: ServiceContext, id: string, reassignToCategoryId?: string) {
    assertPermission(ctx.actor, PERMISSIONS.CATEGORY_DELETE);
    const existing = await categoryRepo.findById(id, true);
    if (!existing) throw ApiError.notFound("دسته‌بندی یافت نشد.");

    const usage = await categoryRepo.articleUsage(id);
    if (usage > 0) {
      if (!reassignToCategoryId) {
        throw ApiError.inUse(
          `این دسته‌بندی به ${usage} مطلب متصل است. ابتدا مطالب را به دسته‌بندی دیگری منتقل کنید.`,
        );
      }
      if (!(await categoryRepo.findById(reassignToCategoryId))) {
        throw ApiError.validation("دسته‌بندی مقصد برای انتقال معتبر نیست.");
      }
      await prismaReassign(id, reassignToCategoryId);
    }

    const deleted = await categoryRepo.setDeletedAt(id, new Date());
    await auditLog({
      userId: ctx.actor.id,
      action: "category.delete",
      entityType: "category",
      entityId: id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      before: { name: existing.name, deletedAt: existing.deletedAt },
      after: { deletedAt: deleted.deletedAt, reassignedTo: reassignToCategoryId ?? null },
    });
    return deleted;
  },

  async restore(ctx: ServiceContext, id: string) {
    assertPermission(ctx.actor, PERMISSIONS.CATEGORY_RESTORE);
    const existing = await categoryRepo.findById(id, true);
    if (!existing) throw ApiError.notFound("دسته‌بندی یافت نشد.");
    const restored = await categoryRepo.setDeletedAt(id, null);
    await auditLog({
      userId: ctx.actor.id,
      action: "category.restore",
      entityType: "category",
      entityId: id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    return restored;
  },
};

// Move all articles from one category to another (both FK and join table).
async function prismaReassign(fromId: string, toId: string) {
  const { prisma } = await import("@/lib/db");
  await prisma.$transaction([
    prisma.article.updateMany({
      where: { primaryCategoryId: fromId },
      data: { primaryCategoryId: toId },
    }),
    // Move join rows that don't already exist on the target.
    prisma.$executeRaw`
      UPDATE "article_categories" ac
      SET "categoryId" = ${toId}
      WHERE ac."categoryId" = ${fromId}
        AND NOT EXISTS (
          SELECT 1 FROM "article_categories" x
          WHERE x."articleId" = ac."articleId" AND x."categoryId" = ${toId}
        )`,
    prisma.articleCategory.deleteMany({ where: { categoryId: fromId } }),
  ]);
}
