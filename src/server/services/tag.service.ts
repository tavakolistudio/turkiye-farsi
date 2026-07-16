import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { tagRepo } from "@/server/data/tag.repo";
import { auditLog } from "@/server/audit/log";
import { assertPermission } from "@/server/rbac/authz";
import { PERMISSIONS } from "@/server/rbac/permissions";
import { ApiError } from "@/lib/api/errors";
import { generateUniqueSlug } from "@/lib/slug";
import { createTagSchema, updateTagSchema } from "@/lib/validations/tag";
import { buildOrderBy, paginationArgs, paginationMeta, type ListQuery } from "@/lib/api/pagination";
import type { ServiceContext } from "./context";
import { registerRedirect } from "./redirect.service";

const SORTABLE = ["name", "createdAt", "updatedAt"] as const;

export const tagService = {
  async list(ctx: ServiceContext, query: ListQuery) {
    assertPermission(ctx.actor, PERMISSIONS.TAG_VIEW);
    const where: Prisma.TagWhereInput = {
      ...(query.includeDeleted ? {} : { deletedAt: null }),
      ...(query.search
        ? { OR: [{ name: { contains: query.search, mode: "insensitive" } }, { slug: { contains: query.search } }] }
        : {}),
    };
    const orderBy = buildOrderBy(query.sort, query.order, SORTABLE, "name");
    const { rows, total } = await tagRepo.list({ where, orderBy, ...paginationArgs(query) });
    return { rows, meta: paginationMeta(query, total) };
  },

  async getById(ctx: ServiceContext, id: string) {
    assertPermission(ctx.actor, PERMISSIONS.TAG_VIEW);
    const tag = await tagRepo.findById(id, true);
    if (!tag) throw ApiError.notFound("برچسب یافت نشد.");
    return tag;
  },

  async create(ctx: ServiceContext, raw: unknown) {
    assertPermission(ctx.actor, PERMISSIONS.TAG_CREATE);
    const input = createTagSchema.parse(raw);
    if (await tagRepo.nameExists(input.name)) {
      throw ApiError.conflict("برچسبی با این نام از قبل وجود دارد.");
    }
    const slug = await generateUniqueSlug(input.slug ?? input.name, (s) => tagRepo.slugExists(s));
    const created = await tagRepo.create({
      name: input.name,
      slug,
      description: input.description,
    });
    await auditLog({
      userId: ctx.actor.id,
      action: "tag.create",
      entityType: "tag",
      entityId: created.id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      after: { name: created.name, slug: created.slug },
    });
    return created;
  },

  async update(ctx: ServiceContext, id: string, raw: unknown) {
    assertPermission(ctx.actor, PERMISSIONS.TAG_UPDATE);
    const input = updateTagSchema.parse(raw);
    const existing = await tagRepo.findById(id, true);
    if (!existing) throw ApiError.notFound("برچسب یافت نشد.");
    if (input.name && input.name !== existing.name && (await tagRepo.nameExists(input.name, id))) {
      throw ApiError.conflict("برچسبی با این نام از قبل وجود دارد.");
    }
    let slug = existing.slug;
    if (input.slug && input.slug !== existing.slug) {
      slug = await generateUniqueSlug(input.slug, (s) => tagRepo.slugExists(s, id));
    }
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.tag.update({ where: { id }, data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        slug,
        ...(input.description !== undefined ? { description: input.description } : {}),
      } });
      if (slug !== existing.slug) {
        await registerRedirect(tx, `/tag/${existing.slug}`, `/tag/${slug}`);
      }
      return row;
    });
    await auditLog({
      userId: ctx.actor.id,
      action: "tag.update",
      entityType: "tag",
      entityId: id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      before: { name: existing.name },
      after: { name: updated.name },
    });
    return updated;
  },

  async softDelete(ctx: ServiceContext, id: string) {
    assertPermission(ctx.actor, PERMISSIONS.TAG_DELETE);
    const existing = await tagRepo.findById(id, true);
    if (!existing) throw ApiError.notFound("برچسب یافت نشد.");
    const deleted = await tagRepo.setDeletedAt(id, new Date());
    await auditLog({
      userId: ctx.actor.id,
      action: "tag.delete",
      entityType: "tag",
      entityId: id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    return deleted;
  },

  async restore(ctx: ServiceContext, id: string) {
    assertPermission(ctx.actor, PERMISSIONS.TAG_DELETE);
    const existing = await tagRepo.findById(id, true);
    if (!existing) throw ApiError.notFound("برچسب یافت نشد.");
    return tagRepo.setDeletedAt(id, null);
  },

  /** Bulk soft-delete. */
  async bulkDelete(ctx: ServiceContext, ids: string[]) {
    assertPermission(ctx.actor, PERMISSIONS.TAG_DELETE);
    const res = await prisma.tag.updateMany({
      where: { id: { in: ids }, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    await auditLog({
      userId: ctx.actor.id,
      action: "tag.delete",
      entityType: "tag",
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      after: { bulk: true, count: res.count, ids },
    });
    return res.count;
  },

  /**
   * Merge `sourceTagId` into `targetTagId`: re-point all article relations to
   * the target (skipping duplicates), then soft-delete the source tag.
   */
  async merge(ctx: ServiceContext, sourceTagId: string, targetTagId: string) {
    assertPermission(ctx.actor, PERMISSIONS.TAG_MERGE);
    if (sourceTagId === targetTagId) {
      throw ApiError.validation("مبدأ و مقصد ادغام نمی‌توانند یکسان باشند.");
    }
    const [source, target] = await Promise.all([
      tagRepo.findById(sourceTagId, true),
      tagRepo.findById(targetTagId),
    ]);
    if (!source) throw ApiError.notFound("برچسب مبدأ یافت نشد.");
    if (!target) throw ApiError.notFound("برچسب مقصد یافت نشد.");

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE "article_tags" at
        SET "tagId" = ${targetTagId}
        WHERE at."tagId" = ${sourceTagId}
          AND NOT EXISTS (
            SELECT 1 FROM "article_tags" x
            WHERE x."articleId" = at."articleId" AND x."tagId" = ${targetTagId}
          )`;
      await tx.articleTag.deleteMany({ where: { tagId: sourceTagId } });
      await tx.tag.update({ where: { id: sourceTagId }, data: { deletedAt: new Date() } });
      await registerRedirect(tx, `/tag/${source.slug}`, `/tag/${target.slug}`);
    });

    await auditLog({
      userId: ctx.actor.id,
      action: "tag.merge",
      entityType: "tag",
      entityId: targetTagId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      before: { mergedFrom: source.name, sourceId: sourceTagId },
      after: { into: target.name, targetId: targetTagId },
    });
    return target;
  },
};
