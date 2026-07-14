import "server-only";
import { prisma } from "@/lib/db";
import { categoryService } from "@/server/services/category.service";
import { tagService } from "@/server/services/tag.service";
import { sourceService } from "@/server/services/source.service";
import { mediaService } from "@/server/services/media.service";
import type { ServiceContext } from "@/server/services/context";

/** Load select options for the article form (categories, tags, authors, media, sources). */
export async function loadArticleFormOptions(ctx: ServiceContext) {
  const base = { page: 1, pageSize: 100, order: "asc" as const, sort: "name", includeDeleted: false };
  const [categories, tags, sources, media, authors] = await Promise.all([
    categoryService.list(ctx, base),
    tagService.list(ctx, base),
    sourceService.list(ctx, base),
    mediaService.list(ctx, { ...base, sort: "createdAt", order: "desc", mimePrefix: "image/" }),
    prisma.user.findMany({ where: { deletedAt: null, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return {
    categories: categories.rows.map((c) => ({ id: c.id, name: c.name })),
    tags: tags.rows.map((t) => ({ id: t.id, name: t.name })),
    sources: sources.rows.map((s) => ({ id: s.id, name: s.name })),
    media: media.rows.map((m) => ({ id: m.id, name: m.originalFilename })),
    authors,
  };
}
