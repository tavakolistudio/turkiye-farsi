import "server-only";
import type { Prisma } from "@prisma/client";
import { sourceRepo } from "@/server/data/source.repo";
import { auditLog } from "@/server/audit/log";
import { assertPermission } from "@/server/rbac/authz";
import { PERMISSIONS } from "@/server/rbac/permissions";
import { ApiError } from "@/lib/api/errors";
import { generateUniqueSlug } from "@/lib/slug";
import { createSourceSchema, updateSourceSchema } from "@/lib/validations/source";
import { buildOrderBy, paginationArgs, paginationMeta, type ListQuery } from "@/lib/api/pagination";
import type { ServiceContext } from "./context";

const SORTABLE = ["name", "createdAt", "updatedAt", "credibilityLevel"] as const;

function buildData(input: {
  websiteUrl?: string;
  country?: string;
  language?: string;
  sourceType?: Prisma.SourceCreateInput["sourceType"];
  credibilityLevel?: Prisma.SourceCreateInput["credibilityLevel"];
  isOfficial?: boolean;
  isActive?: boolean;
  description?: string;
  logoId?: string;
}): Prisma.SourceUpdateInput {
  return {
    ...(input.websiteUrl !== undefined ? { websiteUrl: input.websiteUrl } : {}),
    ...(input.country !== undefined ? { country: input.country } : {}),
    ...(input.language !== undefined ? { language: input.language } : {}),
    ...(input.sourceType !== undefined ? { sourceType: input.sourceType } : {}),
    ...(input.credibilityLevel !== undefined ? { credibilityLevel: input.credibilityLevel } : {}),
    ...(input.isOfficial !== undefined ? { isOfficial: input.isOfficial } : {}),
    ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.logoId !== undefined
      ? { logo: input.logoId ? { connect: { id: input.logoId } } : { disconnect: true } }
      : {}),
  };
}

export const sourceService = {
  async list(ctx: ServiceContext, query: ListQuery) {
    assertPermission(ctx.actor, PERMISSIONS.SOURCE_VIEW);
    const where: Prisma.SourceWhereInput = {
      ...(query.includeDeleted ? {} : { deletedAt: null }),
      ...(query.search
        ? { OR: [{ name: { contains: query.search, mode: "insensitive" } }, { slug: { contains: query.search } }] }
        : {}),
    };
    const orderBy = buildOrderBy(query.sort, query.order, SORTABLE, "name");
    const { rows, total } = await sourceRepo.list({ where, orderBy, ...paginationArgs(query) });
    return { rows, meta: paginationMeta(query, total) };
  },

  async getById(ctx: ServiceContext, id: string) {
    assertPermission(ctx.actor, PERMISSIONS.SOURCE_VIEW);
    const s = await sourceRepo.findById(id, true);
    if (!s) throw ApiError.notFound("منبع یافت نشد.");
    return s;
  },

  async create(ctx: ServiceContext, raw: unknown) {
    assertPermission(ctx.actor, PERMISSIONS.SOURCE_CREATE);
    const input = createSourceSchema.parse(raw);
    const slug = await generateUniqueSlug(input.slug ?? input.name, (s) => sourceRepo.slugExists(s));
    const created = await sourceRepo.create({
      name: input.name,
      slug,
      websiteUrl: input.websiteUrl,
      country: input.country,
      language: input.language,
      sourceType: input.sourceType,
      credibilityLevel: input.credibilityLevel,
      isOfficial: input.isOfficial,
      isActive: input.isActive,
      description: input.description,
      ...(input.logoId ? { logo: { connect: { id: input.logoId } } } : {}),
    });
    await auditLog({
      userId: ctx.actor.id,
      action: "source.create",
      entityType: "source",
      entityId: created.id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      after: { name: created.name, slug: created.slug },
    });
    return created;
  },

  async update(ctx: ServiceContext, id: string, raw: unknown) {
    assertPermission(ctx.actor, PERMISSIONS.SOURCE_UPDATE);
    const input = updateSourceSchema.parse(raw);
    const existing = await sourceRepo.findById(id, true);
    if (!existing) throw ApiError.notFound("منبع یافت نشد.");
    let slug = existing.slug;
    if (input.slug && input.slug !== existing.slug) {
      slug = await generateUniqueSlug(input.slug, (s) => sourceRepo.slugExists(s, id));
    }
    const updated = await sourceRepo.update(id, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      slug,
      ...buildData(input),
    });
    await auditLog({
      userId: ctx.actor.id,
      action: "source.update",
      entityType: "source",
      entityId: id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      before: { name: existing.name, credibilityLevel: existing.credibilityLevel },
      after: { name: updated.name, credibilityLevel: updated.credibilityLevel },
    });
    return updated;
  },

  /** Mark a source as verified (raises credibility). Requires source.verify. */
  async verify(ctx: ServiceContext, id: string) {
    assertPermission(ctx.actor, PERMISSIONS.SOURCE_VERIFY);
    const existing = await sourceRepo.findById(id, true);
    if (!existing) throw ApiError.notFound("منبع یافت نشد.");
    const updated = await sourceRepo.update(id, { credibilityLevel: "VERIFIED" });
    await auditLog({
      userId: ctx.actor.id,
      action: "source.verify",
      entityType: "source",
      entityId: id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      before: { credibilityLevel: existing.credibilityLevel },
      after: { credibilityLevel: "VERIFIED" },
    });
    return updated;
  },

  async softDelete(ctx: ServiceContext, id: string) {
    assertPermission(ctx.actor, PERMISSIONS.SOURCE_DELETE);
    const existing = await sourceRepo.findById(id, true);
    if (!existing) throw ApiError.notFound("منبع یافت نشد.");
    const deleted = await sourceRepo.setDeletedAt(id, new Date());
    await auditLog({
      userId: ctx.actor.id,
      action: "source.delete",
      entityType: "source",
      entityId: id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    return deleted;
  },

  async restore(ctx: ServiceContext, id: string) {
    assertPermission(ctx.actor, PERMISSIONS.SOURCE_DELETE);
    const existing = await sourceRepo.findById(id, true);
    if (!existing) throw ApiError.notFound("منبع یافت نشد.");
    return sourceRepo.setDeletedAt(id, null);
  },
};
