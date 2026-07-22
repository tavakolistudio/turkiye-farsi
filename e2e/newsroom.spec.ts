import { test, expect } from "@playwright/test";
import { prisma } from "@/lib/db";
import { login, ADMIN, AUTHOR } from "./helpers";

/**
 * Newsroom E2E. Offline-safe: instead of hitting external feeds, we seed one
 * scored IngestedNewsItem directly so the review-queue → draft flow is
 * deterministic. Verifies the kill switch, settings, sources/clusters pages,
 * cleanup dry-run, draft creation (private DRAFT) and authorization.
 */

const TAG = `e2e-nr-${Date.now()}`;
let sourceId = "";
let itemId = "";
let createdArticleId = "";

test.beforeAll(async () => {
  const source = await prisma.source.create({
    data: { name: `${TAG} منبع`, slug: `${TAG}-src`, isOfficial: true, trustLevel: 80, collectionMethod: "RSS" },
  });
  sourceId = source.id;
  const item = await prisma.ingestedNewsItem.create({
    data: {
      sourceId: source.id, externalId: `${TAG}-1`, sourceUrl: "https://example.org/a",
      title: `${TAG} قانون تازه اقامت ایرانیان در ترکیه`, excerpt: "خلاصه کوتاه خبر برای آزمون.",
      titleHash: `${TAG}hash`, normalizedTitle: `${TAG} قانون اقامت`, normalizedText: "قانون اقامت ایرانیان ترکیه",
      ingestionStatus: "SCORED", ruleScore: 82, finalScore: 82, scoreBucket: "HIGH", trustScore: 70,
      verificationStatus: "MULTI_SOURCE",
    },
  });
  itemId = item.id;
});

test.afterAll(async () => {
  if (createdArticleId) {
    await prisma.newsDraftProvenance.deleteMany({ where: { articleId: createdArticleId } });
    await prisma.articleSource.deleteMany({ where: { articleId: createdArticleId } });
    await prisma.article.deleteMany({ where: { id: createdArticleId } });
  }
  await prisma.newsDraftProvenance.deleteMany({ where: { primaryItemId: itemId } });
  await prisma.ingestedNewsItem.deleteMany({ where: { sourceId } });
  await prisma.source.deleteMany({ where: { id: sourceId } });
  await prisma.$disconnect();
});

test("super admin sees the newsroom queue with the seeded item", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password, { next: "/admin/newsroom?tab=high" });
  await expect(page.getByRole("heading", { name: "اتاق خبر هوشمند" })).toBeVisible();
  await expect(page.getByText(`${TAG} قانون تازه اقامت`)).toBeVisible();
});

test("kill switch: settings save + disabled collection blocks a run", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password, { next: "/admin/newsroom/settings" });
  await expect(page.getByRole("heading", { name: "تنظیمات اتاق خبر" })).toBeVisible();
  // Ensure collection is OFF and save.
  const collection = page.locator('input[name="collectionEnabled"]');
  if (await collection.isChecked()) await collection.uncheck();
  await page.getByRole("button", { name: "ذخیره تنظیمات" }).click();
  await expect(page.getByText("تنظیمات ذخیره شد.")).toBeVisible();

  // Now a manual run should report the kill switch.
  await page.goto("/admin/newsroom");
  await page.getByRole("button", { name: "اجرای جمع‌آوری" }).click();
  await expect(page.getByText(/غیرفعال است/)).toBeVisible();
});

test("cleanup dry-run reports without deleting", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password, { next: "/admin/newsroom/settings" });
  await page.getByRole("button", { name: "پیش‌نمایش (Dry-run)" }).click();
  await expect(page.getByText(/پیش‌نمایش:/)).toBeVisible();
});

test("sources and clusters pages render", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password, { next: "/admin/newsroom/sources" });
  await expect(page.getByRole("heading", { name: "منابع جمع‌آوری" })).toBeVisible();
  await page.goto("/admin/newsroom/clusters");
  await expect(page.getByRole("heading", { name: "خوشه‌های خبری" })).toBeVisible();
});

test("create draft yields a private DRAFT article in the CMS with sources", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password, { next: "/admin/newsroom?tab=high" });
  await page.getByRole("button", { name: "ساخت پیش‌نویس" }).first().click();
  await expect(page.getByText(/پیش‌نویس ساخته شد/)).toBeVisible();

  // Verify in the DB: DRAFT status, not public, sources attached, provenance.
  const prov = await prisma.newsDraftProvenance.findFirst({ where: { primaryItemId: itemId }, orderBy: { createdAt: "desc" } });
  expect(prov?.articleId).toBeTruthy();
  createdArticleId = prov!.articleId!;
  const article = await prisma.article.findUniqueOrThrow({ where: { id: createdArticleId }, include: { sources: true } });
  expect(article.status).toBe("DRAFT");
  expect(article.publishedAt).toBeNull();
  expect(article.sources.length).toBeGreaterThanOrEqual(1);

  // The draft shows up in the article CMS list.
  await page.goto("/admin/articles");
  await expect(page.getByText(`${TAG} قانون تازه اقامت`).first()).toBeVisible();
});

test("an author has read-only newsroom access (no mutations)", async ({ page }) => {
  await login(page, AUTHOR.email, AUTHOR.password, { next: "/admin/newsroom/settings" });
  // Author has newsroom.view but not manage/scoring → read-only, no save button,
  // and no run/draft/reject controls on the queue (authorization is server-side).
  await expect(page.getByText("شما فقط اجازه مشاهده دارید.")).toBeVisible();
  await expect(page.getByRole("button", { name: "ذخیره تنظیمات" })).toHaveCount(0);
  await page.goto("/admin/newsroom");
  await expect(page.getByRole("button", { name: "اجرای جمع‌آوری" })).toHaveCount(0);
});
