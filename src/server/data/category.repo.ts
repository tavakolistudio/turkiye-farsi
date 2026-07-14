import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

/** Data-access layer for categories. Pure Prisma queries — no authz/audit. */
export const categoryRepo = {
  async slugExists(slug: string, excludeId?: string) {
    const found = await prisma.category.findFirst({
      where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    return !!found;
  },

  findById(id: string, includeDeleted = false) {
    return prisma.category.findFirst({
      where: { id, ...(includeDeleted ? {} : { deletedAt: null }) },
    });
  },

  findBySlug(slug: string) {
    return prisma.category.findFirst({ where: { slug, deletedAt: null } });
  },

  async list(args: {
    where: Prisma.CategoryWhereInput;
    orderBy: Prisma.CategoryOrderByWithRelationInput;
    skip: number;
    take: number;
  }) {
    const [rows, total] = await Promise.all([
      prisma.category.findMany({
        where: args.where,
        orderBy: args.orderBy,
        skip: args.skip,
        take: args.take,
        include: {
          parent: { select: { id: true, name: true } },
          _count: { select: { articles: true, primaryArticles: true } },
        },
      }),
      prisma.category.count({ where: args.where }),
    ]);
    return { rows, total };
  },

  create(data: Prisma.CategoryCreateInput) {
    return prisma.category.create({ data });
  },

  update(id: string, data: Prisma.CategoryUpdateInput) {
    return prisma.category.update({ where: { id }, data });
  },

  setDeletedAt(id: string, value: Date | null) {
    return prisma.category.update({ where: { id }, data: { deletedAt: value } });
  },

  /** Count articles linked to a category (primary FK or join table). */
  async articleUsage(categoryId: string) {
    const [primary, secondary] = await Promise.all([
      prisma.article.count({ where: { primaryCategoryId: categoryId, deletedAt: null } }),
      prisma.articleCategory.count({ where: { categoryId } }),
    ]);
    return primary + secondary;
  },

  /** Load id→parentId map to walk the tree for circular-reference checks. */
  async parentMap() {
    const all = await prisma.category.findMany({ select: { id: true, parentId: true } });
    return new Map(all.map((c) => [c.id, c.parentId]));
  },
};
