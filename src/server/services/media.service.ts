import "server-only";
import type { Prisma } from "@prisma/client";
import { mediaRepo } from "@/server/data/media.repo";
import { auditLog } from "@/server/audit/log";
import { assertPermission } from "@/server/rbac/authz";
import { PERMISSIONS } from "@/server/rbac/permissions";
import { ApiError } from "@/lib/api/errors";
import { getStorageAdapter, validateUpload } from "@/server/storage";
import { updateMediaSchema, createFolderSchema } from "@/lib/validations/media";
import { buildOrderBy, paginationArgs, paginationMeta, type ListQuery } from "@/lib/api/pagination";
import type { ServiceContext } from "./context";

const SORTABLE = ["createdAt", "size", "filename"] as const;

export interface UploadInput {
  buffer: Buffer;
  originalFilename: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  duration?: number;
  folderId?: string;
}

export const mediaService = {
  async list(
    ctx: ServiceContext,
    query: ListQuery & { mimePrefix?: string; folderId?: string },
  ) {
    assertPermission(ctx.actor, PERMISSIONS.MEDIA_VIEW);
    const where: Prisma.MediaWhereInput = {
      ...(query.includeDeleted ? {} : { deletedAt: null }),
      ...(query.mimePrefix ? { mimeType: { startsWith: query.mimePrefix } } : {}),
      ...(query.folderId ? { folderId: query.folderId } : {}),
      ...(query.search
        ? {
            OR: [
              { filename: { contains: query.search, mode: "insensitive" } },
              { originalFilename: { contains: query.search, mode: "insensitive" } },
              { alt: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const orderBy = buildOrderBy(query.sort, query.order, SORTABLE, "createdAt");
    const { rows, total } = await mediaRepo.list({ where, orderBy, ...paginationArgs(query) });
    return { rows, meta: paginationMeta(query, total) };
  },

  async getById(ctx: ServiceContext, id: string) {
    assertPermission(ctx.actor, PERMISSIONS.MEDIA_VIEW);
    const m = await mediaRepo.findById(id, true);
    if (!m) throw ApiError.notFound("رسانه یافت نشد.");
    return m;
  },

  /** Real upload: validate, persist bytes via the storage adapter, store metadata. */
  async upload(ctx: ServiceContext, input: UploadInput) {
    assertPermission(ctx.actor, PERMISSIONS.MEDIA_UPLOAD);
    validateUpload(input.mimeType, input.size);

    const storage = getStorageAdapter();
    const stored = await storage.save({
      buffer: input.buffer,
      originalFilename: input.originalFilename,
      mimeType: input.mimeType,
    });

    const created = await mediaRepo.create({
      filename: stored.storagePath.split("/").pop() ?? input.originalFilename,
      originalFilename: input.originalFilename,
      storagePath: stored.storagePath,
      publicUrl: stored.publicUrl,
      mimeType: input.mimeType,
      size: input.size,
      width: input.width,
      height: input.height,
      duration: input.duration,
      ...(input.folderId ? { folder: { connect: { id: input.folderId } } } : {}),
      ...(ctx.actor.id ? { uploadedBy: { connect: { id: ctx.actor.id } } } : {}),
    });

    await auditLog({
      userId: ctx.actor.id,
      action: "media.upload",
      entityType: "media",
      entityId: created.id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      after: { filename: created.filename, mimeType: created.mimeType, size: created.size },
    });
    return created;
  },

  async updateMeta(ctx: ServiceContext, id: string, raw: unknown) {
    assertPermission(ctx.actor, PERMISSIONS.MEDIA_UPDATE);
    const input = updateMediaSchema.parse(raw);
    const existing = await mediaRepo.findById(id, true);
    if (!existing) throw ApiError.notFound("رسانه یافت نشد.");
    const updated = await mediaRepo.update(id, {
      ...(input.alt !== undefined ? { alt: input.alt } : {}),
      ...(input.caption !== undefined ? { caption: input.caption } : {}),
      ...(input.credit !== undefined ? { credit: input.credit } : {}),
      ...(input.folderId !== undefined
        ? { folder: input.folderId ? { connect: { id: input.folderId } } : { disconnect: true } }
        : {}),
    });
    await auditLog({
      userId: ctx.actor.id,
      action: "media.update",
      entityType: "media",
      entityId: id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      before: { alt: existing.alt, caption: existing.caption },
      after: { alt: updated.alt, caption: updated.caption },
    });
    return updated;
  },

  /** Replace the underlying file, keeping the same media id (and references). */
  async replace(ctx: ServiceContext, id: string, input: UploadInput) {
    assertPermission(ctx.actor, PERMISSIONS.MEDIA_REPLACE);
    validateUpload(input.mimeType, input.size);
    const existing = await mediaRepo.findById(id, true);
    if (!existing) throw ApiError.notFound("رسانه یافت نشد.");

    const storage = getStorageAdapter();
    const stored = await storage.save({
      buffer: input.buffer,
      originalFilename: input.originalFilename,
      mimeType: input.mimeType,
    });
    const updated = await mediaRepo.update(id, {
      filename: stored.storagePath.split("/").pop() ?? input.originalFilename,
      originalFilename: input.originalFilename,
      storagePath: stored.storagePath,
      publicUrl: stored.publicUrl,
      mimeType: input.mimeType,
      size: input.size,
      width: input.width ?? null,
      height: input.height ?? null,
      duration: input.duration ?? null,
    });
    // Remove the old bytes (best-effort).
    await storage.delete(existing.storagePath).catch(() => {});

    await auditLog({
      userId: ctx.actor.id,
      action: "media.replace",
      entityType: "media",
      entityId: id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      before: { storagePath: existing.storagePath },
      after: { storagePath: updated.storagePath },
    });
    return updated;
  },

  async usage(ctx: ServiceContext, id: string) {
    assertPermission(ctx.actor, PERMISSIONS.MEDIA_VIEW);
    return mediaRepo.usage(id);
  },

  /** Soft-delete, but refuse if the media is still referenced anywhere. */
  async softDelete(ctx: ServiceContext, id: string) {
    assertPermission(ctx.actor, PERMISSIONS.MEDIA_DELETE);
    const existing = await mediaRepo.findById(id, true);
    if (!existing) throw ApiError.notFound("رسانه یافت نشد.");
    const usage = await mediaRepo.usage(id);
    if (usage.total > 0) {
      throw ApiError.inUse(`این فایل در ${usage.total} مورد استفاده شده و قابل حذف نیست.`);
    }
    const deleted = await mediaRepo.setDeletedAt(id, new Date());
    await auditLog({
      userId: ctx.actor.id,
      action: "media.delete",
      entityType: "media",
      entityId: id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    return deleted;
  },

  async restore(ctx: ServiceContext, id: string) {
    assertPermission(ctx.actor, PERMISSIONS.MEDIA_RESTORE);
    const existing = await mediaRepo.findById(id, true);
    if (!existing) throw ApiError.notFound("رسانه یافت نشد.");
    return mediaRepo.setDeletedAt(id, null);
  },

  listFolders(ctx: ServiceContext) {
    assertPermission(ctx.actor, PERMISSIONS.MEDIA_VIEW);
    return mediaRepo.listFolders();
  },

  async createFolder(ctx: ServiceContext, raw: unknown) {
    assertPermission(ctx.actor, PERMISSIONS.MEDIA_UPLOAD);
    const input = createFolderSchema.parse(raw);
    return mediaRepo.createFolder({
      name: input.name,
      ...(input.parentId ? { parent: { connect: { id: input.parentId } } } : {}),
    });
  },
};
