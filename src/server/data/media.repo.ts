import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export const mediaRepo = {
  findById(id: string, includeDeleted = false) {
    return prisma.media.findFirst({
      where: { id, ...(includeDeleted ? {} : { deletedAt: null }) },
      include: { folder: { select: { id: true, name: true } }, uploadedBy: { select: { id: true, name: true } } },
    });
  },

  async list(args: {
    where: Prisma.MediaWhereInput;
    orderBy: Prisma.MediaOrderByWithRelationInput;
    skip: number;
    take: number;
  }) {
    const [rows, total] = await Promise.all([
      prisma.media.findMany({
        where: args.where,
        orderBy: args.orderBy,
        skip: args.skip,
        take: args.take,
        include: {
          folder: { select: { id: true, name: true } },
          uploadedBy: { select: { id: true, name: true } },
        },
      }),
      prisma.media.count({ where: args.where }),
    ]);
    return { rows, total };
  },

  create(data: Prisma.MediaCreateInput) {
    return prisma.media.create({ data });
  },

  update(id: string, data: Prisma.MediaUpdateInput) {
    return prisma.media.update({ where: { id }, data });
  },

  setDeletedAt(id: string, value: Date | null) {
    return prisma.media.update({ where: { id }, data: { deletedAt: value } });
  },

  /** Where a media item is used across the content graph. */
  async usage(mediaId: string) {
    const [featured, og, categoryImages, sourceLogos, attached] = await Promise.all([
      prisma.article.count({ where: { featuredImageId: mediaId, deletedAt: null } }),
      prisma.article.count({ where: { ogImageId: mediaId, deletedAt: null } }),
      prisma.category.count({ where: { imageId: mediaId, deletedAt: null } }),
      prisma.source.count({ where: { logoId: mediaId, deletedAt: null } }),
      prisma.articleMedia.count({ where: { mediaId } }),
    ]);
    return {
      featured,
      og,
      categoryImages,
      sourceLogos,
      attached,
      total: featured + og + categoryImages + sourceLogos + attached,
    };
  },

  // Folders
  listFolders() {
    return prisma.mediaFolder.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, parentId: true },
    });
  },

  createFolder(data: Prisma.MediaFolderCreateInput) {
    return prisma.mediaFolder.create({ data });
  },
};
