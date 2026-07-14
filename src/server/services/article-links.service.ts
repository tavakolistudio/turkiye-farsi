import "server-only";
import { prisma } from "@/lib/db";
import { auditLog } from "@/server/audit/log";
import { assertPermission } from "@/server/rbac/authz";
import { PERMISSIONS } from "@/server/rbac/permissions";
import { ApiError } from "@/lib/api/errors";
import { attachSourceSchema } from "@/lib/validations/source";
import { attachMediaSchema } from "@/lib/validations/media";
import type { ServiceContext } from "./context";

/** Attach/detach sources and media to an article. */
export const articleLinksService = {
  async attachSource(ctx: ServiceContext, articleId: string, raw: unknown) {
    assertPermission(ctx.actor, PERMISSIONS.ARTICLE_MANAGE_SOURCES);
    const input = attachSourceSchema.parse(raw);

    const [article, source] = await Promise.all([
      prisma.article.count({ where: { id: articleId, deletedAt: null } }),
      prisma.source.count({ where: { id: input.sourceId, deletedAt: null } }),
    ]);
    if (!article) throw ApiError.notFound("مطلب یافت نشد.");
    if (!source) throw ApiError.validation("منبع معتبر نیست.");

    const link = await prisma.$transaction(async (tx) => {
      if (input.isPrimary) {
        await tx.articleSource.updateMany({ where: { articleId }, data: { isPrimary: false } });
      }
      return tx.articleSource.upsert({
        where: { articleId_sourceId: { articleId, sourceId: input.sourceId } },
        update: {
          sourceUrl: input.sourceUrl,
          sourceTitle: input.sourceTitle,
          accessedAt: input.accessedAt,
          isPrimary: input.isPrimary,
          note: input.note,
        },
        create: {
          article: { connect: { id: articleId } },
          source: { connect: { id: input.sourceId } },
          sourceUrl: input.sourceUrl,
          sourceTitle: input.sourceTitle,
          accessedAt: input.accessedAt,
          isPrimary: input.isPrimary,
          note: input.note,
        },
      });
    });

    // Reflect that the article now has at least one source.
    await prisma.article.update({ where: { id: articleId }, data: { sourceStatus: "ADDED" } });

    await auditLog({
      userId: ctx.actor.id,
      action: "article.update",
      entityType: "article",
      entityId: articleId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      after: { attachedSource: input.sourceId, isPrimary: input.isPrimary },
    });
    return link;
  },

  async detachSource(ctx: ServiceContext, articleId: string, sourceId: string) {
    assertPermission(ctx.actor, PERMISSIONS.ARTICLE_MANAGE_SOURCES);
    await prisma.articleSource.deleteMany({ where: { articleId, sourceId } });
    const remaining = await prisma.articleSource.count({ where: { articleId } });
    if (remaining === 0) {
      await prisma.article.update({ where: { id: articleId }, data: { sourceStatus: "MISSING" } });
    }
    return { ok: true };
  },

  async attachMedia(ctx: ServiceContext, articleId: string, raw: unknown) {
    assertPermission(ctx.actor, PERMISSIONS.ARTICLE_UPDATE_ANY);
    const input = attachMediaSchema.parse(raw);
    const [article, media] = await Promise.all([
      prisma.article.count({ where: { id: articleId, deletedAt: null } }),
      prisma.media.count({ where: { id: input.mediaId, deletedAt: null } }),
    ]);
    if (!article) throw ApiError.notFound("مطلب یافت نشد.");
    if (!media) throw ApiError.validation("رسانه معتبر نیست.");

    return prisma.articleMedia.create({
      data: {
        article: { connect: { id: articleId } },
        media: { connect: { id: input.mediaId } },
        role: input.role,
        order: input.order,
        captionOverride: input.captionOverride,
      },
    });
  },

  async detachMedia(ctx: ServiceContext, articleMediaId: string) {
    assertPermission(ctx.actor, PERMISSIONS.ARTICLE_UPDATE_ANY);
    await prisma.articleMedia.delete({ where: { id: articleMediaId } }).catch(() => {});
    return { ok: true };
  },
};
