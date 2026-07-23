import { expect, test } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";

loadEnv();
const prisma = new PrismaClient();
const stamp = Date.now();
let articleId = "";
let articleSlug = "";
let breakingId = "";

test.describe.serial("Phase 8 editorial design", () => {
  test.beforeAll(async () => {
    const [author, category] = await Promise.all([
      prisma.user.findFirstOrThrow({ where: { deletedAt: null, isActive: true }, select: { id: true } }),
      prisma.category.findFirstOrThrow({ where: { deletedAt: null, isActive: true }, select: { id: true } }),
    ]);
    const article = await prisma.article.create({
      data: {
        title: `تأثیر خبر آزمایشی فاز هشت ${stamp}`,
        slug: `phase-eight-impact-${stamp}`,
        authorId: author.id,
        primaryCategoryId: category.id,
        status: "PUBLISHED",
        contentType: "NEWS",
        publishedAt: new Date(),
        summary: "خلاصه واقعی برای بررسی چیدمان تحریریه‌ای.",
        whyItMatters: "این رویداد می‌تواند بر تصمیم‌های روزمره ایرانیان ترکیه اثر بگذارد.",
        whoIsAffected: "ایرانیانی که موضوع خبر با شرایط زندگی آن‌ها مرتبط است.",
        whatToDo: "منبع رسمی را بررسی کنند و بر پایه اطلاعات تأییدشده تصمیم بگیرند.",
        bodyJson: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "متن خبر برای آزمون طراحی." }] }] },
      },
      select: { id: true, slug: true },
    });
    articleId = article.id;
    articleSlug = article.slug;
    const breaking = await prisma.breakingNews.create({
      data: { title: "خبر فوری آزمایشی طراحی", articleId, isActive: true, priority: 100 },
      select: { id: true },
    });
    breakingId = breaking.id;
  });

  test.afterAll(async () => {
    if (breakingId) await prisma.breakingNews.deleteMany({ where: { id: breakingId } });
    if (articleId) {
      await prisma.pageView.deleteMany({ where: { articleId } });
      await prisma.article.deleteMany({ where: { id: articleId } });
    }
    await prisma.$disconnect();
  });

  for (const width of [375, 768, 1280, 1440]) {
    test(`home has no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }

  test("home exposes the editorial hero, breaking bar and impact signature", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByLabel("اخبار فوری")).toContainText("خبر فوری آزمایشی طراحی");
    await expect(page.getByRole("heading", { name: "این خبر چه تأثیری روی شما دارد؟" })).toBeVisible();
    await expect(page.locator(".homepage-lead-grid")).toBeVisible();
  });

  test("mobile navigation traps focus, closes with Escape and restores focus", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/");
    const toggle = page.getByRole("button", { name: "باز کردن منو" });
    await toggle.click();
    await expect(page.getByRole("dialog", { name: "منوی اصلی" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "منوی اصلی" })).toBeHidden();
    await expect(toggle).toBeFocused();
  });

  test("dark mode uses the editorial dark canvas", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "فعال‌کردن حالت تاریک" }).first().click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    expect(await page.locator("body").evaluate((node) => getComputedStyle(node).backgroundColor)).toBe("rgb(18, 18, 18)");
  });

  test("article is readable on desktop and mobile without changing metadata", async ({ page }) => {
    for (const width of [375, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/news/${articleSlug}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.locator(".article-body")).toContainText("متن خبر برای آزمون طراحی");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
      expect(await page.locator('link[rel="canonical"]').getAttribute("href")).toContain(`/news/${articleSlug}`);
      await expect(page.locator('script[type="application/ld+json"]')).not.toHaveCount(0);
    }
  });

  test("search controls and keyboard focus remain accessible", async ({ page }) => {
    await page.goto("/search");
    const input = page.getByLabel("عبارت جستجو");
    await input.focus();
    await expect(input).toBeFocused();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });
});
