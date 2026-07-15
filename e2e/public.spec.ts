import { test, expect } from "@playwright/test";
import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const run = Date.now();
const draftSlug = `public-draft-${run}`;
const unsafeSlug = `public-unsafe-${run}`;
let published: { id: string; slug: string; title: string; categorySlug: string; tagSlug: string; authorSlug: string };
let publishedId = "";
let draftId = "";
let unsafeId = "";

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const article = await prisma.article.findFirstOrThrow({
    where: { status: "PUBLISHED", deletedAt: null, publishedAt: { not: null }, primaryCategory: { isNot: null }, tags: { some: {} }, author: { profile: { isNot: null } } },
    include: { primaryCategory: true, tags: { include: { tag: true } }, author: { include: { profile: true } } },
  });
  const publicFixture = await prisma.article.create({
    data: {
      title: `خبر عمومی آزمون ${run}`,
      slug: `public-article-${run}`,
      status: "PUBLISHED",
      publishedAt: new Date(),
      isBreaking: true,
      authorId: article.authorId,
      primaryCategoryId: article.primaryCategoryId,
      bodyJson: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "محتوای عمومی امن" }] }] } as Prisma.InputJsonValue,
      tags: { create: { tagId: article.tags[0].tagId } },
    },
  });
  publishedId = publicFixture.id;
  published = { id: publicFixture.id, slug: publicFixture.slug, title: publicFixture.title, categorySlug: article.primaryCategory!.slug, tagSlug: article.tags[0].tag.slug, authorSlug: article.author.profile!.slug };
  const draft = await prisma.article.create({ data: { title: "پیش‌نویس محرمانه عمومی", slug: draftSlug, status: "DRAFT", authorId: article.authorId } });
  draftId = draft.id;
  const unsafe = await prisma.article.create({
    data: {
      title: "آزمون Embed ناامن",
      slug: unsafeSlug,
      status: "PUBLISHED",
      publishedAt: new Date(),
      authorId: article.authorId,
      bodyJson: { type: "doc", content: [{ type: "embed", attrs: { src: "https://evil.example/steal" } }, { type: "paragraph", content: [{ type: "text", text: "متن امن" }] }] } as Prisma.InputJsonValue,
    },
  });
  unsafeId = unsafe.id;
});

test.afterAll(async () => {
  if (draftId) await prisma.article.delete({ where: { id: draftId } });
  if (unsafeId) await prisma.article.delete({ where: { id: unsafeId } });
  if (publishedId) {
    await prisma.pageView.deleteMany({ where: { articleId: publishedId } });
    await prisma.article.delete({ where: { id: publishedId } });
  }
  await prisma.$disconnect();
});

test("1. home loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /ترکیه فارسی، صفحه اصلی/ })).toBeVisible();
  await expect(page.locator("main")).toBeVisible();
});

test("2. hero article opens", async ({ page }) => {
  await page.goto("/");
  const hero = page.locator(".article-card-featured h3 a").first();
  await expect(hero).toBeVisible();
  await hero.click();
  await expect(page).toHaveURL(/\/news\//);
});

test("3. published article displays", async ({ page }) => {
  await page.goto(`/news/${published.slug}`);
  await expect(page.getByRole("heading", { level: 1, name: published.title })).toBeVisible();
  await expect(page.getByText(/بازدید/).first()).toBeVisible();
});

test("4. draft article returns 404", async ({ page }) => {
  const response = await page.goto(`/news/${draftSlug}`);
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "صفحه پیدا نشد" })).toBeVisible();
});

test("5. category page works", async ({ page }) => {
  await page.goto(`/category/${published.categorySlug}`);
  await expect(page.locator(".article-card")).toHaveCount(await page.locator(".article-card").count());
  await expect(page.getByRole("link", { name: published.title }).first()).toBeVisible();
});

test("6. tag page works", async ({ page }) => {
  await page.goto(`/tag/${published.tagSlug}`);
  await expect(page.getByRole("link", { name: published.title }).first()).toBeVisible();
});

test("7. author page works", async ({ page }) => {
  await page.goto(`/author/${published.authorSlug}`);
  await expect(page.getByRole("link", { name: published.title }).first()).toBeVisible();
});

test("8. search returns results", async ({ page }) => {
  await page.goto(`/search?q=${encodeURIComponent(published.title.slice(0, 8))}`);
  await expect(page.getByRole("link", { name: published.title }).first()).toBeVisible();
});

test("9. search empty state", async ({ page }) => {
  await page.goto(`/search?q=${encodeURIComponent(`no-result-${run}`)}`);
  await expect(page.getByText(/نتیجه‌ای پیدا نشد/)).toBeVisible();
});

test("10. latest page works", async ({ page }) => {
  await page.goto("/latest");
  await expect(page.getByRole("heading", { level: 1, name: "آخرین اخبار" })).toBeVisible();
  await expect(page.locator(".latest-timeline li").first()).toBeVisible();
});

test("11. breaking page works", async ({ page }) => {
  await page.goto("/breaking");
  await expect(page.getByRole("heading", { level: 1, name: "اخبار فوری" })).toBeVisible();
});

test("12. mobile navigation works", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "باز کردن منو" }).click();
  await expect(page.getByRole("navigation", { name: "منوی موبایل" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("navigation", { name: "منوی موبایل" })).toBeHidden();
});

test("13. unsafe embed is blocked", async ({ page }) => {
  await page.goto(`/news/${unsafeSlug}`);
  await expect(page.getByText("متن امن")).toBeVisible();
  await expect(page.locator("iframe")).toHaveCount(0);
});

test("14. public page and API do not reveal admin fields", async ({ page }) => {
  await page.goto(`/news/${published.slug}`);
  const html = await page.content();
  expect(html).not.toContain("assignedEditorId");
  expect(html).not.toContain("workflowEvents");
  expect(html).not.toContain("editorialComments");
  const response = await page.request.get(`/api/v1/public/articles/${published.slug}`);
  const payload = JSON.stringify(await response.json());
  expect(payload).not.toContain("assignedEditorId");
  expect(payload).not.toContain("currentVersion");
});
