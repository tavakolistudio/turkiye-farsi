import "server-only";
import type { NotificationType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertPermission } from "@/server/rbac/authz";
import { PERMISSIONS } from "@/server/rbac/permissions";
import { ApiError } from "@/lib/api/errors";
import type { ServiceContext } from "./context";
import type { WorkflowAction } from "@/lib/editorial/workflow";

type DbClient = Prisma.TransactionClient | typeof prisma;

const TYPE_BY_ACTION: Partial<Record<WorkflowAction, NotificationType>> = {
  submit_review: "SUBMIT_REVIEW",
  request_correction: "REQUEST_CORRECTION",
  approve: "APPROVED",
  reject: "REJECTED",
  schedule: "SCHEDULED",
};

const MESSAGE_BY_ACTION: Partial<Record<WorkflowAction, string>> = {
  submit_review: "مطلب برای بررسی ارسال شد.",
  request_correction: "برای مطلب درخواست اصلاح ثبت شد.",
  approve: "مطلب تأیید شد.",
  reject: "مطلب رد شد.",
  schedule: "انتشار مطلب زمان‌بندی شد.",
};

export const notificationService = {
  async notifyTransition(
    db: DbClient,
    article: { id: string; authorId: string; assignedEditorId: string | null },
    action: WorkflowAction,
    actorId: string,
  ) {
    const type = TYPE_BY_ACTION[action];
    const message = MESSAGE_BY_ACTION[action];
    if (!type || !message) return;
    const recipients = new Set<string>();
    if (action === "submit_review" && article.assignedEditorId) recipients.add(article.assignedEditorId);
    if (["request_correction", "approve", "reject", "schedule"].includes(action)) recipients.add(article.authorId);
    recipients.delete(actorId);
    if (!recipients.size) return;
    await db.notification.createMany({
      data: [...recipients].map((userId) => ({ userId, type, articleId: article.id, actorId, message })),
    });
  },

  async publishFailed(db: DbClient, articleId: string, userId: string, message: string) {
    await db.notification.create({
      data: { userId, articleId, type: "PUBLISH_FAILED", message },
    });
  },

  async listMine(ctx: ServiceContext, unreadOnly = false) {
    assertPermission(ctx.actor, PERMISSIONS.ARTICLE_VIEW);
    return prisma.notification.findMany({
      where: { userId: ctx.actor.id, ...(unreadOnly ? { isRead: false } : {}) },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { article: { select: { id: true, title: true } }, actor: { select: { name: true } } },
    });
  },

  async markRead(ctx: ServiceContext, id: string) {
    const result = await prisma.notification.updateMany({
      where: { id, userId: ctx.actor.id },
      data: { isRead: true },
    });
    if (!result.count) throw ApiError.notFound("اعلان یافت نشد.");
    return { id, isRead: true };
  },
};
