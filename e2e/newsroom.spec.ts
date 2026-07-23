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
let splitClusterId = "";
let splitItem1Id = "";
let splitItem2Id = "";
let mergeClusterAId = "";
let mergeClusterBId = "";
let mergeItemAId = "";
let mergeItemBId = "";
let oldRejectedItemId = "";

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

  // A 2-member cluster, for the split-via-UI test.
  const splitItem1 = await prisma.ingestedNewsItem.create({
    data: { sourceId, externalId: `${TAG}-split1`, sourceUrl: "https://example.org/split1", title: `${TAG} خبر جداسازی یک`, ingestionStatus: "SCORED", finalScore: 70, scoreBucket: "HIGH" },
  });
  const splitItem2 = await prisma.ingestedNewsItem.create({
    data: { sourceId, externalId: `${TAG}-split2`, sourceUrl: "https://example.org/split2", title: `${TAG} خبر جداسازی دو`, ingestionStatus: "SCORED", finalScore: 65, scoreBucket: "HIGH" },
  });
  const splitCluster = await prisma.newsStoryCluster.create({
    data: { clusterKey: `${TAG}-split-cluster`, sourceCount: 1, confidence: 0.9, representativeItemId: splitItem1.id },
  });
  await prisma.newsStoryClusterItem.createMany({
    data: [
      { clusterId: splitCluster.id, newsItemId: splitItem1.id, isPrimary: true },
      { clusterId: splitCluster.id, newsItemId: splitItem2.id, isPrimary: false },
    ],
  });
  splitClusterId = splitCluster.id; splitItem1Id = splitItem1.id; splitItem2Id = splitItem2.id;

  // Two single-item clusters, for the merge-via-UI test.
  const mergeItemA = await prisma.ingestedNewsItem.create({
    data: { sourceId, externalId: `${TAG}-mergeA`, sourceUrl: "https://example.org/mergeA", title: `${TAG} خبر ادغام الف`, ingestionStatus: "SCORED", finalScore: 60, scoreBucket: "REVIEW" },
  });
  const mergeItemB = await prisma.ingestedNewsItem.create({
    data: { sourceId, externalId: `${TAG}-mergeB`, sourceUrl: "https://example.org/mergeB", title: `${TAG} خبر ادغام ب`, ingestionStatus: "SCORED", finalScore: 60, scoreBucket: "REVIEW" },
  });
  const mergeClusterA = await prisma.newsStoryCluster.create({ data: { clusterKey: `${TAG}-mergeA`, representativeItemId: mergeItemA.id } });
  const mergeClusterB = await prisma.newsStoryCluster.create({ data: { clusterKey: `${TAG}-mergeB`, representativeItemId: mergeItemB.id } });
  await prisma.newsStoryClusterItem.createMany({
    data: [
      { clusterId: mergeClusterA.id, newsItemId: mergeItemA.id, isPrimary: true },
      { clusterId: mergeClusterB.id, newsItemId: mergeItemB.id, isPrimary: true },
    ],
  });
  mergeClusterAId = mergeClusterA.id; mergeClusterBId = mergeClusterB.id;
  mergeItemAId = mergeItemA.id; mergeItemBId = mergeItemB.id;

  // An old REJECTED item, for the real (non-dry-run) cleanup test.
  const oldRejected = await prisma.ingestedNewsItem.create({
    data: {
      sourceId, externalId: `${TAG}-old`, sourceUrl: "https://example.org/old", title: `${TAG} خبر ردشده قدیمی`,
      ingestionStatus: "REJECTED", createdAt: new Date(Date.now() - 400 * 86_400_000),
    },
  });
  oldRejectedItemId = oldRejected.id;
});

test.afterAll(async () => {
  if (createdArticleId) {
    await prisma.newsDraftProvenance.deleteMany({ where: { articleId: createdArticleId } });
    await prisma.articleSource.deleteMany({ where: { articleId: createdArticleId } });
    await prisma.article.deleteMany({ where: { id: createdArticleId } });
  }
  await prisma.newsDraftProvenance.deleteMany({ where: { primaryItemId: itemId } });

  // Snapshot cluster membership BEFORE deleting items (deletion cascades the
  // join rows), so the split test's newly-created cluster is caught too.
  const allItemIds = [itemId, splitItem1Id, splitItem2Id, mergeItemAId, mergeItemBId, oldRejectedItemId].filter(Boolean);
  const clusterLinks = await prisma.newsStoryClusterItem.findMany({ where: { newsItemId: { in: allItemIds } }, select: { clusterId: true } });
  const clusterIds = [...new Set([splitClusterId, mergeClusterAId, mergeClusterBId, ...clusterLinks.map((l) => l.clusterId)])].filter(Boolean);

  await prisma.ingestedNewsItem.deleteMany({ where: { sourceId } });
  if (clusterIds.length) await prisma.newsStoryCluster.deleteMany({ where: { id: { in: clusterIds } } });
  await prisma.source.deleteMany({ where: { id: sourceId } });
  await prisma.$disconnect();
});

test("super admin sees the newsroom queue with the seeded item", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password, { next: "/admin/newsroom?tab=high" });
  await expect(page.getByRole("heading", { name: "اتاق خبر هوشمند" })).toBeVisible();
  await expect(page.getByText(`${TAG} قانون تازه اقامت`)).toBeVisible();
});

test("7: importance score and trust are visible on the queue card", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password, { next: "/admin/newsroom?tab=high" });
  await expect(page.getByText("اهمیت: 82")).toBeVisible();
  await expect(page.getByText(/اعتماد: 70/)).toBeVisible();
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

test("4: a manual run genuinely executes once collection is re-enabled", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password, { next: "/admin/newsroom/settings" });
  const isEnabled = page.locator('input[name="isEnabled"]');
  if (!(await isEnabled.isChecked())) await isEnabled.check();
  const collection = page.locator('input[name="collectionEnabled"]');
  if (!(await collection.isChecked())) await collection.check();
  await page.getByRole("button", { name: "ذخیره تنظیمات" }).click();
  await expect(page.getByText("تنظیمات ذخیره شد.")).toBeVisible();

  await page.goto("/admin/newsroom");
  await page.getByRole("button", { name: "اجرای جمع‌آوری" }).click();
  // The seeded source has no feedUrl, so nothing is actually fetched — but the
  // run must genuinely execute (a real batch), not report the kill switch.
  await expect(page.getByText(/اجرا کامل شد/)).toBeVisible();

  // Restore the default (disabled) state for the tests that follow.
  await page.goto("/admin/newsroom/settings");
  const collectionAgain = page.locator('input[name="collectionEnabled"]');
  if (await collectionAgain.isChecked()) await collectionAgain.uncheck();
  await page.getByRole("button", { name: "ذخیره تنظیمات" }).click();
  await expect(page.getByText("تنظیمات ذخیره شد.")).toBeVisible();
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

test("14: cluster split via UI moves the selected item into a new cluster", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password, { next: `/admin/newsroom/clusters/${splitClusterId}` });
  await expect(page.getByText(`${TAG} خبر جداسازی دو`)).toBeVisible();
  await page.getByRole("checkbox", { name: `انتخاب آیتم ${TAG} خبر جداسازی دو` }).check();
  await page.getByRole("button", { name: /جداسازی به خوشه جدید/ }).click();
  await expect(page.getByText(/آیتم به خوشه جدید منتقل شد/)).toBeVisible();

  const links = await prisma.newsStoryClusterItem.findMany({ where: { newsItemId: { in: [splitItem1Id, splitItem2Id] } } });
  expect(new Set(links.map((l) => l.clusterId)).size).toBe(2); // now in two different clusters
});

test("13: cluster merge via UI combines two clusters into one", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password, { next: "/admin/newsroom/clusters" });
  await expect(page.getByText(`${TAG} خبر ادغام الف`)).toBeVisible();
  await page.getByRole("checkbox", { name: `انتخاب خوشه ${TAG} خبر ادغام الف` }).check();
  await page.getByRole("checkbox", { name: `انتخاب خوشه ${TAG} خبر ادغام ب` }).check();
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: /ادغام انتخاب‌شده‌ها/ }).click();
  await expect(page.getByText(/خوشه ادغام شد/)).toBeVisible();

  const links = await prisma.newsStoryClusterItem.findMany({ where: { newsItemId: { in: [mergeItemAId, mergeItemBId] } } });
  expect(new Set(links.map((l) => l.clusterId)).size).toBe(1); // now in the same cluster
});

test("19: real (non-dry-run) cleanup only removes the allowed old-rejected data", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password, { next: "/admin/newsroom/settings" });
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "اجرای پاک‌سازی" }).click();
  await expect(page.getByText(/انجام شد:/)).toBeVisible();

  const oldItem = await prisma.ingestedNewsItem.findUniqueOrThrow({ where: { id: oldRejectedItemId } });
  expect(oldItem.deletedAt).not.toBeNull(); // soft-deleted
  const mainItem = await prisma.ingestedNewsItem.findUniqueOrThrow({ where: { id: itemId } });
  expect(mainItem.deletedAt).toBeNull(); // untouched — not REJECTED
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

test("12: reprocess via UI re-scores an already-drafted item (idempotent, stays DRAFTED)", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password, { next: "/admin/newsroom?tab=drafted" });
  await page.getByRole("button", { name: "بازپردازش" }).first().click();
  await expect(page.getByText(/بازپردازش شد/)).toBeVisible();
  const refreshed = await prisma.ingestedNewsItem.findUniqueOrThrow({ where: { id: itemId } });
  expect(refreshed.ingestionStatus).toBe("DRAFTED"); // reprocess never un-drafts an item
});

test("13: regenerate via UI rebuilds the draft and keeps it DRAFT", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password, { next: "/admin/newsroom?tab=drafted" });
  await page.getByRole("button", { name: "بازتولید پیش‌نویس" }).first().click();
  await expect(page.getByText(/پیش‌نویس بازتولید شد/)).toBeVisible();
  const article = await prisma.article.findUniqueOrThrow({ where: { id: createdArticleId } });
  expect(article.status).toBe("DRAFT"); // regenerate never auto-advances status — no auto-publish
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
