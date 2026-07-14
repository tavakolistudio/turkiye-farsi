import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { PERMISSIONS } from "@/server/rbac/permissions";
import type { ServiceContext } from "@/server/services/context";
import type { AuthUser } from "@/server/rbac/authz";
import { articleService } from "@/server/services/article.service";
import { articleLinksService } from "@/server/services/article-links.service";
import { categoryService } from "@/server/services/category.service";
import { sourceService } from "@/server/services/source.service";
import { editorialWorkflowService } from "@/server/services/editorial-workflow.service";
import { schedulingService } from "@/server/services/scheduling.service";
import { revisionService } from "@/server/services/revision.service";
import { correctionService } from "@/server/services/correction.service";
import { publicContentService } from "@/server/services/public-content.service";
import { ApiError } from "@/lib/api/errors";

const PREFIX = `editorial-${Date.now()}`;
let ctx: ServiceContext;
let articleId = "";
let categoryId = "";
let sourceId = "";

function actor(id: string): AuthUser {
  return { id, email: "editorial@test.local", name: "Editorial Test", isActive: true, roleKeys: ["SUPER_ADMIN"], permissions: new Set(Object.values(PERMISSIONS)) };
}

beforeAll(async () => {
  const user = await prisma.user.findFirstOrThrow({ where: { deletedAt: null } });
  ctx = { actor: actor(user.id), ip: null, userAgent: "vitest" };
});

afterAll(async () => {
  if (articleId) {
    await prisma.publishJobLog.deleteMany({ where: { articleId } });
    await prisma.article.deleteMany({ where: { id: articleId } });
  }
  if (sourceId) await prisma.source.deleteMany({ where: { id: sourceId } });
  if (categoryId) await prisma.category.deleteMany({ where: { id: categoryId } });
});

describe("complete editorial workflow", () => {
  it("runs autosave, correction loop, schedule, cron, restore and correction publishing", async () => {
    const category = await categoryService.create(ctx, { name: `${PREFIX} دسته` });
    const source = await sourceService.create(ctx, { name: `${PREFIX} منبع` });
    categoryId = category.id;
    sourceId = source.id;
    const created = await articleService.create(ctx, {
      title: `${PREFIX} پیش‌نویس کامل`,
      summary: "خلاصه برای تست گردش کار",
      primaryCategoryId: category.id,
      bodyJson: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "این متن خبری کامل برای سنجش فرایند انتشار تحریریه است." }] }] },
    });
    articleId = created.id;
    await articleLinksService.attachSource(ctx, articleId, { sourceId: source.id, isPrimary: true });

    const saved = await editorialWorkflowService.autosave(ctx, articleId, {
      version: 0,
      title: `${PREFIX} نسخه ذخیره‌شده`,
      bodyJson: created.bodyJson,
    });
    expect(saved.currentVersion).toBe(1);
    await expect(editorialWorkflowService.autosave(ctx, articleId, { version: 0, title: "نسخه قدیمی" }))
      .rejects.toMatchObject({ code: "VERSION_CONFLICT" } satisfies Partial<ApiError>);

    await editorialWorkflowService.transition(ctx, articleId, { action: "submit_review", version: 1, assignedEditorId: ctx.actor.id });
    await editorialWorkflowService.transition(ctx, articleId, { action: "request_correction", note: "منبع و تیتر بازبینی شود" });
    const corrected = await editorialWorkflowService.autosave(ctx, articleId, { version: 1, title: `${PREFIX} نسخه اصلاح‌شده` });
    await editorialWorkflowService.transition(ctx, articleId, { action: "submit_review", version: corrected.currentVersion });
    await editorialWorkflowService.transition(ctx, articleId, { action: "approve" });

    const due = new Date(Date.now() + 200);
    await editorialWorkflowService.transition(ctx, articleId, { action: "schedule", scheduledAt: due.toISOString() });
    await new Promise((resolve) => setTimeout(resolve, 220));
    const cron = await schedulingService.runDue();
    expect(cron.results).toContainEqual({ articleId, status: "SUCCESS" });
    expect((await prisma.article.findUniqueOrThrow({ where: { id: articleId } })).status).toBe("PUBLISHED");

    const publicArticle = await publicContentService.getArticleBySlug(created.slug);
    expect(publicArticle.id).toBe(articleId);

    const revisions = await revisionService.list(ctx, articleId);
    expect(revisions.length).toBeGreaterThanOrEqual(4);
    const current = await prisma.article.findUniqueOrThrow({ where: { id: articleId } });
    const restored = await revisionService.restore(ctx, articleId, revisions.at(-1)!.id, current.currentVersion);
    expect(restored.currentVersion).toBe(current.currentVersion + 1);

    const correction = await correctionService.create(ctx, articleId, {
      title: "اصلاح جزئی",
      description: "یک عبارت برای شفافیت بیشتر اصلاح شد.",
      correctionType: "MINOR",
      order: 1,
    });
    await correctionService.publish(ctx, articleId, correction.id);
    expect((await prisma.articleCorrection.findUniqueOrThrow({ where: { id: correction.id } })).isPublished).toBe(true);
  });
});
