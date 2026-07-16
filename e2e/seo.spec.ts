import { test, expect, type Page } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";

loadEnv();
const prisma = new PrismaClient();

/**
 * Phase 7 SEO E2E. XML feeds are fetched and genuinely parsed with the browser's
 * DOMParser (not just status-checked), and redirect/draft fixtures prove the
 * no-leak / redirect behaviour end-to-end.
 */

const TS = Date.now();
const ids: string[] = [];
let heroSlug = "";
let authorSlug = "";
let categorySlug = "";
let draftSlug = "";

/** Parse an XML string in the page context; returns validity + probe helpers. */
async function parseXml(page: Page, xml: string) {
  return page.evaluate((text) => {
    const doc = new DOMParser().parseFromString(text, "application/xml");
    const err = doc.querySelector("parsererror");
    return {
      ok: !err,
      root: doc.documentElement?.tagName ?? "",
      hasNewsPublication: !!doc.getElementsByTagName("news:publication").length,
      urlCount: doc.getElementsByTagName("url").length,
      itemCount: doc.getElementsByTagName("item").length,
      sitemapCount: doc.getElementsByTagName("sitemap").length,
    };
  }, xml);
}

/** Collect all JSON-LD @type values on the current page. */
async function jsonLdTypes(page: Page): Promise<string[]> {
  return page.$$eval('script[type="application/ld+json"]', (nodes) => {
    const types: string[] = [];
    const walk = (o: unknown) => {
      if (Array.isArray(o)) return o.forEach(walk);
      if (o && typeof o === "object") {
        const rec = o as Record<string, unknown>;
        if (typeof rec["@type"] === "string") types.push(rec["@type"] as string);
        Object.values(rec).forEach(walk);
      }
    };
    for (const n of nodes) {
      try {
        walk(JSON.parse(n.textContent || "{}"));
      } catch {
        /* ignore malformed */
      }
    }
    return types;
  });
}

test.beforeAll(async () => {
  const hero = await prisma.article.findFirstOrThrow({
    where: { status: "PUBLISHED", deletedAt: null, isHero: true },
    select: { slug: true, primaryCategory: { select: { slug: true } }, author: { select: { profile: { select: { slug: true } } } } },
  });
  heroSlug = hero.slug;
  categorySlug = hero.primaryCategory?.slug ?? (await prisma.category.findFirstOrThrow({ select: { slug: true } })).slug;
  authorSlug = hero.author.profile?.slug ?? (await prisma.profile.findFirstOrThrow({ select: { slug: true } })).slug;

  const author = await prisma.user.findFirstOrThrow({ where: { deletedAt: null }, select: { id: true } });
  const category = await prisma.category.findFirstOrThrow({ select: { id: true } });
  const draft = await prisma.article.create({
    data: { title: `SEO Draft ${TS}`, slug: `seo-draft-${TS}`, contentType: "NEWS", status: "DRAFT", authorId: author.id, primaryCategoryId: category.id },
  });
  draftSlug = draft.slug;
  ids.push(draft.id);

  await prisma.redirect.createMany({
    data: [
      { from: `/news/seo-old-${TS}`, to: `/news/${heroSlug}`, permanent: true },
      { from: `/news/seo-loopa-${TS}`, to: `/news/seo-loopb-${TS}`, permanent: true },
      { from: `/news/seo-loopb-${TS}`, to: `/news/seo-loopa-${TS}`, permanent: true },
    ],
  });
});

test.afterAll(async () => {
  await prisma.redirect.deleteMany({ where: { from: { contains: `-${TS}` } } });
  await prisma.article.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
});

test("1. home has a non-empty title", async ({ page }) => {
  await page.goto("/");
  const title = await page.title();
  expect(title.trim().length).toBeGreaterThan(3);
});

test("2. article has an absolute canonical", async ({ page }) => {
  await page.goto(`/news/${encodeURIComponent(heroSlug)}`);
  const href = await page.locator('link[rel="canonical"]').getAttribute("href");
  expect(href).toMatch(/^https?:\/\/.+\/news\//);
});

test("3. article has NewsArticle + Breadcrumb JSON-LD", async ({ page }) => {
  await page.goto(`/news/${encodeURIComponent(heroSlug)}`);
  const types = await jsonLdTypes(page);
  expect(types).toContain("NewsArticle");
  expect(types).toContain("BreadcrumbList");
  expect(types).toContain("Person");
});

test("4. draft article is not public (404)", async ({ page }) => {
  const res = await page.goto(`/news/${draftSlug}`);
  expect(res?.status()).toBe(404);
});

test("5. category page has title + canonical", async ({ page }) => {
  await page.goto(`/category/${encodeURIComponent(categorySlug)}`);
  expect((await page.title()).trim().length).toBeGreaterThan(3);
  expect(await page.locator('link[rel="canonical"]').getAttribute("href")).toMatch(/\/category\//);
});

test("6. author page has Person JSON-LD", async ({ page }) => {
  await page.goto(`/author/${encodeURIComponent(authorSlug)}`);
  expect(await jsonLdTypes(page)).toContain("Person");
});

test("7. sitemap index is valid XML", async ({ page }) => {
  await page.goto("/");
  const res = await page.request.get("/sitemap.xml");
  expect(res.status()).toBe(200);
  const info = await parseXml(page, await res.text());
  expect(info.ok).toBe(true);
  expect(info.root).toBe("sitemapindex");
  expect(info.sitemapCount).toBeGreaterThan(0);
});

test("8. news sitemap is valid and uses the news namespace", async ({ page }) => {
  await page.goto("/");
  const res = await page.request.get("/news-sitemap.xml");
  expect(res.status()).toBe(200);
  const info = await parseXml(page, await res.text());
  expect(info.ok).toBe(true);
  expect(info.root).toBe("urlset");
  expect(info.hasNewsPublication).toBe(true);
});

test("9. RSS feed is valid XML with items", async ({ page }) => {
  await page.goto("/");
  const res = await page.request.get("/rss.xml");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("xml");
  const info = await parseXml(page, await res.text());
  expect(info.ok).toBe(true);
  expect(info.root).toBe("rss");
  expect(info.itemCount).toBeGreaterThan(0);
});

test("10. robots.txt loads", async ({ request }) => {
  const res = await request.get("/robots.txt");
  expect(res.status()).toBe(200);
  expect((await res.text()).toLowerCase()).toContain("user-agent");
});

test("11. search page is noindex", async ({ page }) => {
  await page.goto(`/search?q=${encodeURIComponent("اقامت")}`);
  const robots = await page.locator('meta[name="robots"]').getAttribute("content");
  expect(robots).toContain("noindex");
});

test("12. preview responses are noindex", async ({ request }) => {
  const res = await request.get("/preview/anything", { maxRedirects: 0 });
  expect(res.headers()["x-robots-tag"]).toContain("noindex");
});

test("13. slug-change redirect issues a permanent redirect", async ({ request }) => {
  const res = await request.get(`/news/seo-old-${TS}`, { maxRedirects: 0 });
    expect(res.status()).toBe(301);
  expect(res.headers()["location"]).toContain("/news/");
});

test("14. a redirect loop is blocked with 404", async ({ page }) => {
  const res = await page.goto(`/news/seo-loopa-${TS}`);
  expect(res?.status()).toBe(404);
});

test("15. article exposes Open Graph metadata", async ({ page }) => {
  await page.goto(`/news/${encodeURIComponent(heroSlug)}`);
  expect(await page.locator('meta[property="og:type"]').getAttribute("content")).toBe("article");
  expect((await page.locator('meta[property="og:title"]').getAttribute("content"))?.length).toBeGreaterThan(0);
  expect(await page.locator('meta[property="og:url"]').getAttribute("content")).toMatch(/^https?:\/\//);
});

test("16. public article does not expose internal/admin fields", async ({ page }) => {
  await page.goto(`/news/${encodeURIComponent(heroSlug)}`);
  const html = await page.content();
  for (const marker of ["factCheckStatus", "assignedEditor", "internalNote", "IN_REVIEW"]) {
    expect(html).not.toContain(marker);
  }
});
