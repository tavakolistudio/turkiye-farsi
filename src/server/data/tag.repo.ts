import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export const tagRepo = {
  async slugExists(slug: string, excludeId?: string) {
    const f = await prisma.tag.findFirst({
      where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    return !!f;
  },

  async nameExists(name: string, excludeId?: string) {
    const f = await prisma.tag.findFirst({
      where: { name, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    return !!f;
  },

  findById(id: string, includeDeleted = false) {
    return prisma.tag.findFirst({
      where: { id, ...(includeDeleted ? {} : { deletedAt: null }) },
    });
  },

  findBySlug(slug: string) {
    return prisma.tag.findFirst({ where: { slug, deletedAt: null } });
  },

  async list(args: {
    where: Prisma.TagWhereInput;
    orderBy: Prisma.TagOrderByWithRelationInput;
    skip: number;
    take: number;
  }) {
    const [rows, total] = await Promise.all([
      prisma.tag.findMany({
        where: args.where,
        orderBy: args.orderBy,
        skip: args.skip,
        take: args.take,
        include: { _count: { select: { articles: true } } },
      }),
      prisma.tag.count({ where: args.where }),
    ]);
    return { rows, total };
  },

  create(data: Prisma.TagCreateInput) {
    return prisma.tag.create({ data });
  },

  update(id: string, data: Prisma.TagUpdateInput) {
    return prisma.tag.update({ where: { id }, data });
  },

  setDeletedAt(id: string, value: Date | null) {
    return prisma.tag.update({ where: { id }, data: { deletedAt: value } });
  },
};
