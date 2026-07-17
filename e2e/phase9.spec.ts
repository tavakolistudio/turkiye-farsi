import { expect, test } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";

loadEnv();
const prisma = new PrismaClient();
const stamp = Date.now();
const query = `phase9-${stamp}`;
const ids: string[] = [];
let authorSlug = "";
let categorySlug = "";

test.beforeAll(async () => {
  const author = await prisma.user.findFirstOrThrow({
    where: { deletedAt: null, isActive: true, profile: { isPublic: true } },
    select: { id: true, profile: { select: { slug: true } } },
  });
  const category = await prisma.category.findFirstOrThrow({
    where: { deletedAt: null, isActive: true },
    select: { id: true, slug: true },
  });
  authorSlug = author.profile!.slug;
  categorySlug = category.slug;

  for (let index = 0; index < 14; index += 1) {
    const article = await prisma.article.create({
      data: {
        title: `${query} نتیجه ${index + 1}`,
        slug: `${query}-${index + 1}`,
        summary: "نتیجه عمومی جست‌وجوی فاز نه",
        status: "PUBLISHED",
        contentType: "NEWS",
        publishedAt: new Date(Date.now() - index * 60_000),
        authorId: author.id,
        primaryCategoryId: category.id,
      },
      select: { id: true },
    });
    ids.push(article.id);
  }
});

test.afterAll(async () => {
  await prisma.searchLog.deleteMany({ where: { query: { contains: query } } });
  await prisma.article.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
});

test("dynamic metadata exposes canonical hreflang, Open Graph and Twitter", async ({ page }) => {
  await page.goto(`/category/${encodeURIComponent(categorySlug)}`);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/category\//);
  await expect(page.locator('link[rel="alternate"][hreflang="fa-IR"]')).toHaveAttribute("href", /^https?:\/\//);
  await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute("href", /^https?:\/\//);
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", /.+/);
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
});

test("search filters by author, category and date then loads the next page", async ({ page }) => {
  const today = new Date().toISOString().slice(0, 10);
  await page.goto(`/search?q=${encodeURIComponent(query)}&author=${encodeURIComponent(authorSlug)}&category=${encodeURIComponent(categorySlug)}&from=${today}&to=${today}`);
  await expect(page.locator("#s-author")).toHaveValue(authorSlug);
  await expect(page.locator("#s-category")).toHaveValue(categorySlug);
  await page.getByRole("button", { name: "نمایش نتایج بیشتر" }).scrollIntoViewIfNeeded();
  await expect(page.locator('[data-testid="search-results"] article')).toHaveCount(14, { timeout: 20_000 });
  await expect(page.getByText("پایان نتایج")).toBeAttached();
});

test("search remains noindex and keyboard-operable", async ({ page }) => {
  await page.goto(`/search?q=${encodeURIComponent(query)}`);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await page.locator("#s-q").focus();
  await expect(page.locator("#s-q")).toBeFocused();
  await expect(page.locator('label[for="s-author"]')).toBeVisible();
  await expect(page.locator('label[for="s-from"]')).toBeVisible();
});
