import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { seoFeedService } from "@/server/services/seo-feed.service";
import { redirectService } from "@/server/services/redirect.service";
import robots from "@/app/robots";

const PREFIX = `seo-${Date.now()}`;
const ids: string[] = [];
let authorId = "";
let categoryId = "";
let publishedSlug = "";

async function mkArticle(over: { title: string; slug: string; status?: string; publishedAt?: Date | null; deletedAt?: Date | null; isBreaking?: boolean }) {
  const a = await prisma.article.create({
    data: {
      title: over.title,
      slug: over.slug,
      summary: `${PREFIX} summary`,
      contentType: "NEWS",
      status: (over.status ?? "PUBLISHED") as never,
      isBreaking: over.isBreaking ?? false,
      publishedAt: over.publishedAt ?? new Date(),
      deletedAt: over.deletedAt ?? null,
      readingTime: 1,
      authorId,
      primaryCategoryId: categoryId,
    },
  });
  ids.push(a.id);
  return a;
}

beforeAll(async () => {
  const admin = await prisma.user.findFirstOrThrow({ where: { deletedAt: null } });
  authorId = admin.id;
  categoryId = (await prisma.category.findFirstOrThrow({ select: { id: true } })).id;

  const pub = await mkArticle({ title: `${PREFIX} منتشر`, slug: `${PREFIX}-pub`, isBreaking: true });
  publishedSlug = pub.slug;
  await mkArticle({ title: `${PREFIX} پیش‌نویس`, slug: `${PREFIX}-draft`, status: "DRAFT", publishedAt: null });
  await mkArticle({ title: `${PREFIX} زمان‌بندی`, slug: `${PREFIX}-sched`, status: "SCHEDULED", publishedAt: new Date(Date.now() + 864e5) });
  await mkArticle({ title: `${PREFIX} آینده`, slug: `${PREFIX}-future`, status: "PUBLISHED", publishedAt: new Date(Date.now() + 864e5) });
  await mkArticle({ title: `${PREFIX} قدیمی`, slug: `${PREFIX}-old`, status: "PUBLISHED", publishedAt: new Date(Date.now() - 5 * 864e5) });
  await mkArticle({ title: `${PREFIX} حذف`, slug: `${PREFIX}-del`, status: "PUBLISHED", deletedAt: new Date() });
});

afterAll(async () => {
  await prisma.redirect.deleteMany({ where: { from: { startsWith: `/${PREFIX}` } } });
  await prisma.article.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
});

describe("sitemap feed data", () => {
  it("articles() includes published (any date), excludes draft/scheduled/future/deleted", async () => {
    const all = await seoFeedService.articles(0, 1000);
    const paths = all.map((e) => e.path);
    expect(paths).toContain(`/news/${PREFIX}-pub`);
    expect(paths).toContain(`/news/${PREFIX}-old`); // old is still a valid published URL
    expect(paths).not.toContain(`/news/${PREFIX}-draft`);
    expect(paths).not.toContain(`/news/${PREFIX}-sched`);
    expect(paths).not.toContain(`/news/${PREFIX}-future`);
    expect(paths).not.toContain(`/news/${PREFIX}-del`);
  });
});

describe("news sitemap (48h window)", () => {
  it("includes only recent published news", async () => {
    const news = await seoFeedService.recentNews(1000);
    const slugs = news.map((n) => n.slug);
    expect(slugs).toContain(`${PREFIX}-pub`);
    expect(slugs).not.toContain(`${PREFIX}-old`); // >48h
    expect(slugs).not.toContain(`${PREFIX}-future`);
    expect(slugs).not.toContain(`${PREFIX}-draft`);
    expect(slugs).not.toContain(`${PREFIX}-sched`);
  });
});

describe("rss feed data", () => {
  it("returns only published, and filters by breaking", async () => {
    const all = await seoFeedService.rss({ limit: 500 });
    const slugs = all.map((r) => r.slug);
    expect(slugs).toContain(`${PREFIX}-pub`);
    expect(slugs).not.toContain(`${PREFIX}-draft`);
    expect(slugs).not.toContain(`${PREFIX}-sched`);

    const breaking = await seoFeedService.rss({ limit: 500, breaking: true });
    expect(breaking.map((r) => r.slug)).toContain(`${PREFIX}-pub`);
  });
});

describe("redirect resolver", () => {
  it("follows a chain to the final destination", async () => {
    await prisma.redirect.createMany({
      data: [
        { from: `/${PREFIX}/a`, to: `/${PREFIX}/b`, permanent: true },
        { from: `/${PREFIX}/b`, to: `/${PREFIX}/c`, permanent: true },
      ],
    });
    const r = await redirectService.resolve(`/${PREFIX}/a`);
    expect(r).toEqual({ to: `/${PREFIX}/c`, permanent: true });
  });

  it("returns null (404) for a cycle instead of ping-ponging", async () => {
    await prisma.redirect.createMany({
      data: [
        { from: `/${PREFIX}/loop1`, to: `/${PREFIX}/loop2`, permanent: true },
        { from: `/${PREFIX}/loop2`, to: `/${PREFIX}/loop1`, permanent: true },
      ],
    });
    expect(await redirectService.resolve(`/${PREFIX}/loop1`)).toBeNull();
  });

  it("returns null when there is no redirect", async () => {
    expect(await redirectService.resolve(`/${PREFIX}/nope`)).toBeNull();
  });

  it("marks a chain temporary if any hop is temporary", async () => {
    await prisma.redirect.createMany({
      data: [
        { from: `/${PREFIX}/t1`, to: `/${PREFIX}/t2`, permanent: true },
        { from: `/${PREFIX}/t2`, to: `/${PREFIX}/t3`, permanent: false },
      ],
    });
    const r = await redirectService.resolve(`/${PREFIX}/t1`);
    expect(r).toEqual({ to: `/${PREFIX}/t3`, permanent: false });
  });
});

describe("robots policy", () => {
  it("disallows everything when not a production deployment", () => {
    const prev = process.env.VERCEL_ENV;
    delete process.env.VERCEL_ENV; // NODE_ENV is "test" here → not indexable
    const r = robots();
    const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    expect(rule?.disallow).toBe("/");
    expect(r.sitemap).toBeUndefined();
    if (prev === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = prev;
  });

  it("allows crawling with sitemaps on a production deployment", () => {
    const prev = process.env.VERCEL_ENV;
    process.env.VERCEL_ENV = "production";
    const r = robots();
    const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    expect(rule?.allow).toBe("/");
    expect(String(rule?.disallow)).toContain("/admin");
    expect(Array.isArray(r.sitemap) ? r.sitemap.join(" ") : String(r.sitemap)).toContain("/sitemap.xml");
    if (prev === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = prev;
  });
});

// silence unused warning for publishedSlug (kept for readability/debugging)
void publishedSlug;
