import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export const sourceRepo = {
  async slugExists(slug: string, excludeId?: string) {
    const f = await prisma.source.findFirst({
      where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    return !!f;
  },

  findById(id: string, includeDeleted = false) {
    return prisma.source.findFirst({
      where: { id, ...(includeDeleted ? {} : { deletedAt: null }) },
    });
  },

  findBySlug(slug: string) {
    return prisma.source.findFirst({ where: { slug, deletedAt: null } });
  },

  async list(args: {
    where: Prisma.SourceWhereInput;
    orderBy: Prisma.SourceOrderByWithRelationInput;
    skip: number;
    take: number;
  }) {
    const [rows, total] = await Promise.all([
      prisma.source.findMany({
        where: args.where,
        orderBy: args.orderBy,
        skip: args.skip,
        take: args.take,
        include: { _count: { select: { articles: true } } },
      }),
      prisma.source.count({ where: args.where }),
    ]);
    return { rows, total };
  },

  create(data: Prisma.SourceCreateInput) {
    return prisma.source.create({ data });
  },

  update(id: string, data: Prisma.SourceUpdateInput) {
    return prisma.source.update({ where: { id }, data });
  },

  setDeletedAt(id: string, value: Date | null) {
    return prisma.source.update({ where: { id }, data: { deletedAt: value } });
  },
};
