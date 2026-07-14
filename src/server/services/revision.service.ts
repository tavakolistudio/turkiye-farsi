import "server-only";
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api/errors";
import { bodyJsonText, sanitizeBodyJson } from "@/lib/editorial/content";
import { assertPermission } from "@/server/rbac/authz";
import { PERMISSIONS } from "@/server/rbac/permissions";
import { auditLog } from "@/server/audit/log";
import type { ServiceContext } from "./context";
import { readingTimeService } from "./reading-time.service";

type DbClient = Prisma.TransactionClient | PrismaClient;

function jsonValue(value: Prisma.JsonValue | null): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  return value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}

export const revisionService = {
  async createSnapshot(db: DbClient, articleId: string, changedById: string, changeReason: string) {
    const article = await db.article.findUnique({ where: { id: articleId } });
    if (!article) throw ApiError.notFound("مطلب یافت نشد.");
    const latest = await db.articleRevision.aggregate({
      where: { articleId },
      _max: { versionNumber: true },
    });
    return db.articleRevision.create({
      data: {
        articleId,
        versionNumber: (latest._max.versionNumber ?? 0) + 1,
        title: article.title,
        subtitle: article.subtitle,
        summary: article.summary,
        bodyJson: jsonValue(article.bodyJson),
        metaTitle: article.metaTitle,
        metaDescription: article.metaDescription,
        whyItMatters: article.whyItMatters,
        whoIsAffected: article.whoIsAffected,
        whatToDo: article.whatToDo,
        status: article.status,
        changedById,
        changeReason,
      },
    });
  },

  async list(ctx: ServiceContext, articleId: string) {
    assertPermission(ctx.actor, PERMISSIONS.ARTICLE_VIEW_REVISION);
    return prisma.articleRevision.findMany({
      where: { articleId },
      orderBy: { versionNumber: "desc" },
      include: { changedBy: { select: { id: true, name: true } } },
    });
  },

  async compare(ctx: ServiceContext, articleId: string, fromId: string, toId: string) {
    assertPermission(ctx.actor, PERMISSIONS.ARTICLE_VIEW_REVISION);
    const revisions = await prisma.articleRevision.findMany({
      where: { articleId, id: { in: [fromId, toId] } },
    });
    if (revisions.length !== 2) throw ApiError.notFound("نسخه یافت نشد.");
    const from = revisions.find((item) => item.id === fromId)!;
    const to = revisions.find((item) => item.id === toId)!;
    const fields = ["title", "subtitle", "summary", "metaTitle", "metaDescription"] as const;
    const changes: { field: string; before: unknown; after: unknown }[] = fields.flatMap((field) =>
      from[field] === to[field] ? [] : [{ field, before: from[field], after: to[field] }],
    );
    const beforeBody = bodyJsonText(from.bodyJson);
    const afterBody = bodyJsonText(to.bodyJson);
    if (beforeBody !== afterBody) changes.push({ field: "bodyJson", before: beforeBody, after: afterBody });
    return { from: from.versionNumber, to: to.versionNumber, changes };
  },

  async restore(ctx: ServiceContext, articleId: string, revisionId: string, expectedVersion: number) {
    assertPermission(ctx.actor, PERMISSIONS.ARTICLE_RESTORE_REVISION);
    const result = await prisma.$transaction(async (tx) => {
      const [article, revision] = await Promise.all([
        tx.article.findUnique({ where: { id: articleId } }),
        tx.articleRevision.findFirst({ where: { id: revisionId, articleId } }),
      ]);
      if (!article || !revision) throw ApiError.notFound("مطلب یا نسخه یافت نشد.");
      if (article.currentVersion !== expectedVersion) throw ApiError.versionConflict(article.currentVersion);
      await this.createSnapshot(tx, articleId, ctx.actor.id, "پیش از بازیابی نسخه");
      const bodyJson = sanitizeBodyJson(revision.bodyJson);
      const updated = await tx.article.updateMany({
        where: { id: articleId, currentVersion: expectedVersion },
        data: {
          title: revision.title,
          subtitle: revision.subtitle,
          summary: revision.summary,
          bodyJson,
          metaTitle: revision.metaTitle,
          metaDescription: revision.metaDescription,
          whyItMatters: revision.whyItMatters,
          whoIsAffected: revision.whoIsAffected,
          whatToDo: revision.whatToDo,
          readingTime: readingTimeService.calculate(bodyJson).minutes,
          currentVersion: { increment: 1 },
        },
      });
      if (!updated.count) throw ApiError.versionConflict(expectedVersion + 1);
      await this.createSnapshot(tx, articleId, ctx.actor.id, `بازیابی نسخه ${revision.versionNumber}`);
      return tx.article.findUniqueOrThrow({ where: { id: articleId } });
    });
    await auditLog({
      userId: ctx.actor.id,
      action: "article.revision.restore",
      entityType: "article",
      entityId: articleId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      after: { revisionId, currentVersion: result.currentVersion },
    });
    return result;
  },
};
