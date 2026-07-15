import { test, expect } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";

loadEnv();
const prisma = new PrismaClient();

/**
 * Phase 6 public website E2E. Exercises the real pages against the seeded dev
 * database, plus a few purpose-built fixtures (draft, scheduled, and an article
 * carrying deliberately-unsafe body content) to prove isolation and rendering
 * safety.
 */

const TS = Date.now();
const ids: string[] = [];
let heroSlug = "";
let categorySlug = "";
let authorSlug = "";
let tagSlug = "";
let draftSlug = "";
let scheduledSlug = "";
let unsafeSlug = "";

const doc = (paragraphs: string[]) => ({
  type: "doc",
  content: paragraphs.map((p) => ({ type: "paragraph", content: [{ type: "text", text: p }] })),
});

test.beforeAll(async () => {
  const hero = await prisma.article.findFirstOrThrow({
    where: { status: "PUBLISHED", deletedAt: null, isHero: true },
    select: { slug: true, primaryCategory: { select: { slug: true } }, author: { select: { profile: { select: { slug: true } } } }, tags: { select: { tag: { select: { slug: true } } } } },
  });
  heroSlug = hero.slug;
  categorySlug = hero.primaryCategory?.slug ?? (await prisma.category.findFirstOrThrow({ select: { slug: true } })).slug;
  authorSlug = hero.author.profile?.slug ?? (await prisma.profile.findFirstOrThrow({ select: { slug: true } })).slug;
  tagSlug = hero.tags[0]?.tag.slug ?? (await prisma.tag.findFirstOrThrow({ select: { slug: true } })).slug;

  const author = await prisma.user.findFirstOrThrow({ where: { deletedAt: null }, select: { id: true } });
  const category = await prisma.category.findFirstOrThrow({ select: { id: true } });
  const base = {
    contentType: "NEWS" as const,
    authorId: author.id,
    primaryCategoryId: category.id,
    readingTime: 1,
  };

  const draft = await prisma.article.create({
    data: { ...base, title: `E2E Draft ${TS}`, slug: `e2e-draft-${TS}`, status: "DRAFT", bodyJson: doc(["draft body"]) },
  });
  draftSlug = draft.slug;
  ids.push(draft.id);

  const scheduled = await prisma.article.create({
    data: { ...base, title: `E2E Scheduled ${TS}`, slug: `e2e-scheduled-${TS}`, status: "SCHEDULED", scheduledAt: new Date(Date.now() + 864e5), publishedAt: new Date(Date.now() + 864e5), bodyJson: doc(["scheduled body"]) },
  });
  scheduledSlug = scheduled.slug;
  ids.push(scheduled.id);

  // Published article whose body was NOT run through the sanitizer — carries a
  // script node, an iframe to a foreign host, and a javascript: link. The
  // public renderer must neutralise all of these.
  const unsafeBody = {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "SAFE_TEXT_MARKER" }] },
      { type: "script", content: [{ type: "text", text: "EVIL_SCRIPT_MARKER" }] },
      { type: "iframe", attrs: { src: "https://evil.example.com/attack" } },
      { type: "paragraph", content: [{ type: "text", text: "کلیک خطرناک", marks: [{ type: "link", attrs: { href: "javascript:alert('xss')" } }] }] },
    ],
  };
  const unsafe = await prisma.article.create({
    data: { ...base, title: `E2E Unsafe ${TS}`, slug: `e2e-unsafe-${TS}`, status: "PUBLISHED", publishedAt: new Date(), bodyJson: unsafeBody },
  });
  unsafeSlug = unsafe.slug;
  ids.push(unsafe.id);
});

test.afterAll(async () => {
  await prisma.pageView.deleteMany({ where: { articleId: { in: ids } } });
  await prisma.article.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
});

test("1. home page loads with news content", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(page.locator("main#main-content")).toBeVisible();
  await expect(page.getByRole("contentinfo")).toBeVisible();
});

test("2. hero article opens from the home page", async ({ page }) => {
  await page.goto("/");
  const heroLink = page.locator(`a[href*="${encodeURIComponent(heroSlug)}"]`).first();
  await expect(heroLink).toBeVisible();
  await heroLink.click();
  await expect(page).toHaveURL(new RegExp(encodeURIComponent(heroSlug).slice(0, 20)));
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("3. published article displays full content", async ({ page }) => {
  await page.goto(`/news/${encodeURIComponent(heroSlug)}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText("اشتراک‌گذاری:")).toBeVisible();
  await expect(page.locator("article").getByText(/بازدید$/).first()).toBeVisible();
});

test("4. draft article returns 404", async ({ page }) => {
  const res = await page.goto(`/news/${draftSlug}`);
  expect(res?.status()).toBe(404);
});

test("5. scheduled article returns 404", async ({ page }) => {
  const res = await page.goto(`/news/${scheduledSlug}`);
  expect(res?.status()).toBe(404);
});

test("6. category page works", async ({ page }) => {
  const res = await page.goto(`/category/${encodeURIComponent(categorySlug)}`);
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("7. tag page works", async ({ page }) => {
  const res = await page.goto(`/tag/${encodeURIComponent(tagSlug)}`);
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("8. author page works and hides private data", async ({ page }) => {
  const res = await page.goto(`/author/${encodeURIComponent(authorSlug)}`);
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(await page.content()).not.toContain("passwordHash");
});

test("9. search returns results", async ({ page }) => {
  await page.goto(`/search?q=${encodeURIComponent("اقامت")}`);
  await expect(page.getByText(/نتیجه برای/)).toBeVisible();
});

test("10. search shows an empty state for no matches", async ({ page }) => {
  await page.goto(`/search?q=${encodeURIComponent("زققثجحخکنمبل")}`);
  await expect(page.getByText(/نتیجه‌ای برای/)).toBeVisible();
});

test("11. latest page works", async ({ page }) => {
  const res = await page.goto("/latest");
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "آخرین اخبار", level: 1 })).toBeVisible();
});

test("12. breaking page works", async ({ page }) => {
  const res = await page.goto("/breaking");
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "اخبار فوری", level: 1 })).toBeVisible();
});

test("13. most-viewed page works across ranges", async ({ page }) => {
  const res = await page.goto("/most-viewed?range=all");
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("tab", { name: "همه زمان‌ها" })).toBeVisible();
});

test("14. mobile navigation opens and links work", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 780 });
  await page.goto("/");
  await page.getByRole("button", { name: "باز کردن منو" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("link").first().click();
  await expect(page).toHaveURL(/\/category\//);
});

test("15. unsafe embedded content is neutralised", async ({ page }) => {
  await page.goto(`/news/${unsafeSlug}`);
  const body = page.locator(".article-body");
  await expect(body).toContainText("SAFE_TEXT_MARKER");
  // The script node is dropped; its text never renders.
  await expect(body).not.toContainText("EVIL_SCRIPT_MARKER");
  // No foreign iframe and no javascript: anchors reach the DOM.
  expect(await body.locator('iframe[src*="evil.example.com"]').count()).toBe(0);
  expect(await page.locator('a[href^="javascript:"]').count()).toBe(0);
  // The dangerous link text survives as plain text.
  await expect(body).toContainText("کلیک خطرناک");
});

test("16. public API does not expose admin/internal fields", async ({ request }) => {
  const res = await request.get(`/api/v1/public/articles/${encodeURIComponent(heroSlug)}`);
  expect(res.status()).toBe(200);
  const json = await res.json();
  const article = json.data;
  for (const field of ["factCheckStatus", "scheduledAt", "assignedEditorId", "metaTitle", "internalNote"]) {
    expect(article).not.toHaveProperty(field);
  }
});

test("17. static page loads from the database", async ({ page }) => {
  const res = await page.goto("/about");
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "درباره ما", level: 1 })).toBeVisible();
});

test("18. contact page does not fabricate contact details", async ({ page }) => {
  await page.goto("/contact");
  await expect(page.getByRole("heading", { name: "تماس با ما", level: 1 })).toBeVisible();
  // No fabricated phone number: there is no tel: link anywhere on the page.
  expect(await page.locator('a[href^="tel:"]').count()).toBe(0);
});
