import "server-only";
import type { ArticleStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api/errors";
import { sanitizeBodyJson } from "@/lib/editorial/content";
import { transitionFor } from "@/lib/editorial/workflow";
import { autosaveSchema, commentCreateSchema, workflowSchema } from "@/lib/validations/editorial";
import { assertPermission, hasPermission } from "@/server/rbac/authz";
import { PERMISSIONS } from "@/server/rbac/permissions";
import { auditLog } from "@/server/audit/log";
import type { ServiceContext } from "./context";
import { readingTimeService } from "./reading-time.service";
import { revisionService } from "./revision.service";
import { notificationService } from "./notification.service";
import { publishValidationService } from "./publish-validation.service";

const EDITABLE_STATUSES: ArticleStatus[] = ["DRAFT", "NEEDS_CORRECTION", "IN_REVIEW", "APPROVED", "UNPUBLISHED"];

function canEdit(ctx: ServiceContext, article: { authorId: string }) {
  return hasPermission(ctx.actor, PERMISSIONS.ARTICLE_UPDATE_ANY)
    || (hasPermission(ctx.actor, PERMISSIONS.ARTICLE_UPDATE_OWN) && article.authorId === ctx.actor.id);
}

async function ensureAssignedEditor(id: string | null | undefined) {
  if (!id) return;
  const exists = await prisma.user.count({ where: { id, deletedAt: null, isActive: true } });
  if (!exists) throw ApiError.validation("ویراستار انتخاب‌شده معتبر نیست.");
}

export const editorialWorkflowService = {
  async autosave(ctx: ServiceContext, articleId: string, raw: unknown) {
    const input = autosaveSchema.parse(raw);
    const article = await prisma.article.findUnique({ where: { id: articleId } });
    if (!article || article.deletedAt) throw ApiError.notFound("مطلب یافت نشد.");
    if (!canEdit(ctx, article)) throw ApiError.forbidden();
    if (!EDITABLE_STATUSES.includes(article.status)) throw ApiError.conflict("این وضعیت اجازهٔ ویرایش محتوا را نمی‌دهد.");
    if (article.currentVersion !== input.version) throw ApiError.versionConflict(article.currentVersion);

    const bodyJson = input.bodyJson === undefined ? undefined : sanitizeBodyJson(input.bodyJson);
    const data: Prisma.ArticleUpdateManyMutationInput = {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.subtitle !== undefined ? { subtitle: input.subtitle || null } : {}),
      ...(input.summary !== undefined ? { summary: input.summary || null } : {}),
      ...(bodyJson !== undefined
        ? { bodyJson, readingTime: readingTimeService.calculate(bodyJson).minutes }
        : {}),
      ...(input.whyItMatters !== undefined ? { whyItMatters: input.whyItMatters || null } : {}),
      ...(input.whoIsAffected !== undefined ? { whoIsAffected: input.whoIsAffected || null } : {}),
      ...(input.whatToDo !== undefined ? { whatToDo: input.whatToDo || null } : {}),
      currentVersion: { increment: 1 },
    };
    const saved = await prisma.article.updateMany({
      where: { id: articleId, currentVersion: input.version },
      data,
    });
    if (!saved.count) {
      const fresh = await prisma.article.findUnique({ where: { id: articleId }, select: { currentVersion: true } });
      throw ApiError.versionConflict(fresh?.currentVersion ?? input.version + 1);
    }
    const currentVersion = input.version + 1;
    await auditLog({
      userId: ctx.actor.id,
      action: "article.autosave",
      entityType: "article",
      entityId: articleId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      after: { currentVersion },
    });
    return { articleId, currentVersion, savedAt: new Date() };
  },

  async transition(ctx: ServiceContext, articleId: string, raw: unknown) {
    const input = workflowSchema.parse(raw);
    const transitionResult = await prisma.$transaction(async (tx) => {
      const article = await tx.article.findUnique({
        where: { id: articleId },
        include: { sources: { select: { id: true } } },
      });
      if (!article || article.deletedAt) throw ApiError.notFound("مطلب یافت نشد.");
      const transition = transitionFor(article.status, input.action);
      if (!transition) throw ApiError.invalidTransition(article.status, input.action);
      assertPermission(ctx.actor, transition.permission);
      if (input.action === "submit_review" && !canEdit(ctx, article)) throw ApiError.forbidden();
      if (transition.noteRequired && !input.note?.trim()) throw ApiError.validation("ثبت توضیح برای این عملیات الزامی است.");
      if (input.version !== undefined && input.version !== article.currentVersion) {
        throw ApiError.versionConflict(article.currentVersion);
      }
      await ensureAssignedEditor(input.assignedEditorId);
      if (input.action === "schedule") {
        if (!input.scheduledAt) throw ApiError.validation("زمان انتشار الزامی است.");
        if (new Date(input.scheduledAt) <= new Date()) throw ApiError.validation("زمان انتشار باید در آینده باشد.");
        publishValidationService.assert(publishValidationService.validate(article));
      }
      if (input.action === "publish") publishValidationService.assert(publishValidationService.validate(article));

      const now = new Date();
      const data: Prisma.ArticleUpdateInput = {
        status: transition.to,
        ...(input.assignedEditorId !== undefined
          ? { assignedEditor: input.assignedEditorId ? { connect: { id: input.assignedEditorId } } : { disconnect: true } }
          : {}),
        ...(input.action === "schedule" ? { scheduledAt: new Date(input.scheduledAt!) } : {}),
        ...(input.action === "cancel_schedule" ? { scheduledAt: null } : {}),
        ...(input.action === "publish" ? { publishedAt: now, scheduledAt: null } : {}),
      };
      const updated = await tx.article.update({ where: { id: articleId }, data });
      await tx.articleWorkflowEvent.create({
        data: {
          articleId,
          fromStatus: article.status,
          toStatus: transition.to,
          actorId: ctx.actor.id,
          note: input.note,
        },
      });
      if (transition.revision) {
        await revisionService.createSnapshot(tx, articleId, ctx.actor.id, input.note || input.action);
      }
      await notificationService.notifyTransition(tx, updated, input.action, ctx.actor.id);
      return { before: article.status, article: updated };
    });
    await auditLog({
      userId: ctx.actor.id,
      action: `article.workflow.${input.action}`,
      entityType: "article",
      entityId: articleId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      before: { status: transitionResult.before },
      after: { status: transitionResult.article.status, note: input.note },
    });
    return transitionResult.article;
  },

  async timeline(ctx: ServiceContext, articleId: string) {
    assertPermission(ctx.actor, PERMISSIONS.ARTICLE_VIEW);
    return prisma.articleWorkflowEvent.findMany({
      where: { articleId },
      orderBy: { createdAt: "desc" },
      include: { actor: { select: { id: true, name: true } } },
    });
  },

  async reviewQueue(ctx: ServiceContext) {
    assertPermission(ctx.actor, PERMISSIONS.ARTICLE_VIEW);
    return prisma.article.findMany({
      where: { status: { in: ["IN_REVIEW", "NEEDS_CORRECTION"] }, deletedAt: null },
      orderBy: { updatedAt: "asc" },
      include: {
        author: { select: { id: true, name: true } },
        assignedEditor: { select: { id: true, name: true } },
        primaryCategory: { select: { name: true } },
      },
    });
  },

  async scheduledArticles(ctx: ServiceContext) {
    assertPermission(ctx.actor, PERMISSIONS.ARTICLE_SCHEDULE);
    return prisma.article.findMany({
      where: { status: "SCHEDULED", deletedAt: null },
      orderBy: { scheduledAt: "asc" },
      include: { author: { select: { name: true } }, assignedEditor: { select: { name: true } } },
    });
  },

  async comments(ctx: ServiceContext, articleId: string) {
    assertPermission(ctx.actor, PERMISSIONS.ARTICLE_VIEW);
    return prisma.editorialComment.findMany({
      where: { articleId, deletedAt: null, parentId: null },
      orderBy: { createdAt: "asc" },
      include: {
        author: { select: { id: true, name: true } },
        replies: { where: { deletedAt: null }, orderBy: { createdAt: "asc" }, include: { author: { select: { id: true, name: true } } } },
      },
    });
  },

  async addComment(ctx: ServiceContext, articleId: string, raw: unknown) {
    assertPermission(ctx.actor, PERMISSIONS.ARTICLE_VIEW);
    const input = commentCreateSchema.parse(raw);
    if (input.parentId) {
      const parent = await prisma.editorialComment.findFirst({ where: { id: input.parentId, articleId, deletedAt: null } });
      if (!parent) throw ApiError.validation("نظر والد معتبر نیست.");
    }
    const comment = await prisma.editorialComment.create({
      data: { articleId, authorId: ctx.actor.id, body: input.body, parentId: input.parentId },
      include: { author: { select: { id: true, name: true } } },
    });
    await auditLog({ userId: ctx.actor.id, action: "article.comment.create", entityType: "editorial_comment", entityId: comment.id });
    return comment;
  },

  async resolveComment(ctx: ServiceContext, articleId: string, commentId: string, isResolved: boolean) {
    assertPermission(ctx.actor, PERMISSIONS.ARTICLE_UPDATE_ANY);
    const result = await prisma.editorialComment.updateMany({
      where: { id: commentId, articleId, deletedAt: null },
      data: { isResolved },
    });
    if (!result.count) throw ApiError.notFound("نظر یافت نشد.");
    return { id: commentId, isResolved };
  },
};
