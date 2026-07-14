import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api/errors";
import { assertPermission, hasPermission } from "@/server/rbac/authz";
import { PERMISSIONS } from "@/server/rbac/permissions";
import { previewCreateSchema } from "@/lib/validations/editorial";
import { auditLog } from "@/server/audit/log";
import type { ServiceContext } from "./context";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export const previewService = {
  async create(ctx: ServiceContext, articleId: string, raw: unknown) {
    const input = previewCreateSchema.parse(raw);
    const article = await prisma.article.findUnique({ where: { id: articleId }, select: { authorId: true } });
    if (!article) throw ApiError.notFound("مطلب یافت نشد.");
    const allowed = hasPermission(ctx.actor, PERMISSIONS.ARTICLE_UPDATE_ANY)
      || (hasPermission(ctx.actor, PERMISSIONS.ARTICLE_UPDATE_OWN) && article.authorId === ctx.actor.id);
    if (!allowed) throw ApiError.forbidden();
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + input.expiresInMinutes * 60_000);
    await prisma.previewToken.create({
      data: { tokenHash: hashToken(token), articleId, createdById: ctx.actor.id, expiresAt },
    });
    await auditLog({ userId: ctx.actor.id, action: "article.preview.create", entityType: "article", entityId: articleId });
    return { token, expiresAt };
  },

  async resolve(token: string) {
    if (!token || token.length > 200) throw ApiError.notFound("پیش‌نمایش یافت نشد.");
    const record = await prisma.previewToken.findUnique({
      where: { tokenHash: hashToken(token) },
      include: {
        article: {
          include: {
            author: { select: { name: true } },
            primaryCategory: { select: { name: true } },
            featuredImage: { select: { publicUrl: true, alt: true } },
          },
        },
      },
    });
    if (!record) throw ApiError.notFound("پیش‌نمایش یافت نشد.");
    if (record.expiresAt <= new Date()) {
      await prisma.previewToken.delete({ where: { id: record.id } }).catch(() => undefined);
      throw new ApiError("TOKEN_EXPIRED", "توکن پیش‌نمایش منقضی شده است.");
    }
    if (record.article.deletedAt) throw ApiError.notFound("پیش‌نمایش یافت نشد.");
    return { article: record.article, expiresAt: record.expiresAt };
  },

  async revokeAll(ctx: ServiceContext, articleId: string) {
    assertPermission(ctx.actor, PERMISSIONS.ARTICLE_UPDATE_ANY);
    return prisma.previewToken.deleteMany({ where: { articleId } });
  },
};
