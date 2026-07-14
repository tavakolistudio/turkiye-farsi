import "server-only";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api/errors";
import { correctionCreateSchema } from "@/lib/validations/editorial";
import { assertPermission } from "@/server/rbac/authz";
import { PERMISSIONS } from "@/server/rbac/permissions";
import { auditLog } from "@/server/audit/log";
import type { ServiceContext } from "./context";

export const correctionService = {
  async list(ctx: ServiceContext, articleId: string) {
    assertPermission(ctx.actor, PERMISSIONS.ARTICLE_VIEW);
    return prisma.articleCorrection.findMany({
      where: { articleId, deletedAt: null },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      include: { correctedBy: { select: { id: true, name: true } } },
    });
  },

  async create(ctx: ServiceContext, articleId: string, raw: unknown) {
    assertPermission(ctx.actor, PERMISSIONS.ARTICLE_UPDATE_ANY);
    const input = correctionCreateSchema.parse(raw);
    const article = await prisma.article.findUnique({ where: { id: articleId }, select: { status: true } });
    if (!article) throw ApiError.notFound("مطلب یافت نشد.");
    if (!['PUBLISHED', 'UNPUBLISHED'].includes(article.status)) {
      throw ApiError.conflict("اصلاحیه فقط برای مطلبی که سابقه انتشار دارد قابل ثبت است.");
    }
    const correction = await prisma.articleCorrection.create({
      data: { ...input, articleId, correctedById: ctx.actor.id },
    });
    await auditLog({ userId: ctx.actor.id, action: "article.correction.create", entityType: "article_correction", entityId: correction.id, after: input });
    return correction;
  },

  async update(ctx: ServiceContext, articleId: string, correctionId: string, raw: unknown) {
    assertPermission(ctx.actor, PERMISSIONS.ARTICLE_UPDATE_ANY);
    const input = correctionCreateSchema.partial().parse(raw);
    const existing = await prisma.articleCorrection.findFirst({ where: { id: correctionId, articleId, deletedAt: null } });
    if (!existing) throw ApiError.notFound("اصلاحیه یافت نشد.");
    if (existing.isPublished) throw ApiError.conflict("اصلاحیهٔ منتشرشده قابل ویرایش نیست.");
    return prisma.articleCorrection.update({ where: { id: correctionId }, data: input });
  },

  async publish(ctx: ServiceContext, articleId: string, correctionId: string) {
    assertPermission(ctx.actor, PERMISSIONS.ARTICLE_PUBLISH);
    const existing = await prisma.articleCorrection.findFirst({ where: { id: correctionId, articleId, deletedAt: null } });
    if (!existing) throw ApiError.notFound("اصلاحیه یافت نشد.");
    if (existing.isPublished) return existing;
    const published = await prisma.articleCorrection.update({
      where: { id: correctionId },
      data: { isPublished: true, publishedAt: new Date() },
    });
    await auditLog({ userId: ctx.actor.id, action: "article.correction.publish", entityType: "article_correction", entityId: correctionId });
    return published;
  },
};
