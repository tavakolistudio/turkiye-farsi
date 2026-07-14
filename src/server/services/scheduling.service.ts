import "server-only";
import { prisma } from "@/lib/db";
import { revisionService } from "./revision.service";
import { notificationService } from "./notification.service";
import { publishValidationService } from "./publish-validation.service";

export const EDITORIAL_TIME_ZONE = "Europe/Istanbul";

export const schedulingService = {
  /** Dates enter the API with an explicit offset; Date normalizes them to UTC for PostgreSQL. */
  toUtc(isoWithOffset: string) {
    const date = new Date(isoWithOffset);
    if (Number.isNaN(date.getTime())) throw new Error("invalid schedule date");
    return date;
  },

  async runDue(now = new Date(), limit = 50) {
    const due = await prisma.article.findMany({
      where: { status: "SCHEDULED", scheduledAt: { lte: now }, deletedAt: null },
      orderBy: { scheduledAt: "asc" },
      take: Math.min(limit, 100),
      include: { sources: { select: { id: true } } },
    });
    const results: { articleId: string; status: "SUCCESS" | "FAILED" | "SKIPPED"; error?: string }[] = [];
    for (const article of due) {
      try {
        publishValidationService.assert(publishValidationService.validate(article));
        const status = await prisma.$transaction(async (tx) => {
          const claimed = await tx.article.updateMany({
            where: { id: article.id, status: "SCHEDULED", scheduledAt: { lte: now } },
            data: { status: "PUBLISHED", publishedAt: now, scheduledAt: null },
          });
          if (!claimed.count) {
            await tx.publishJobLog.create({ data: { articleId: article.id, jobType: "scheduled_publish", status: "SKIPPED", detail: "already claimed" } });
            return "SKIPPED" as const;
          }
          const actorId = article.assignedEditorId ?? article.authorId;
          await tx.articleWorkflowEvent.create({
            data: { articleId: article.id, fromStatus: "SCHEDULED", toStatus: "PUBLISHED", actorId, note: "انتشار خودکار زمان‌بندی‌شده" },
          });
          await revisionService.createSnapshot(tx, article.id, actorId, "انتشار خودکار زمان‌بندی‌شده");
          await tx.publishJobLog.create({ data: { articleId: article.id, jobType: "scheduled_publish", status: "SUCCESS" } });
          return "SUCCESS" as const;
        });
        results.push({ articleId: article.id, status });
      } catch (error) {
        const message = error instanceof Error ? error.message.slice(0, 1_000) : "خطای نامشخص";
        await prisma.$transaction(async (tx) => {
          await tx.publishJobLog.create({ data: { articleId: article.id, jobType: "scheduled_publish", status: "FAILED", error: message } });
          await notificationService.publishFailed(tx, article.id, article.assignedEditorId ?? article.authorId, "انتشار زمان‌بندی‌شده ناموفق بود؛ در اجرای بعدی دوباره تلاش می‌شود.");
        });
        results.push({ articleId: article.id, status: "FAILED", error: message });
      }
    }
    return { checkedAt: now, count: results.length, results };
  },
};
