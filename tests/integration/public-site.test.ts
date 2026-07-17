import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { PERMISSIONS } from "@/server/rbac/permissions";
import type { AuthUser } from "@/server/rbac/authz";
import type { ServiceContext } from "@/server/services/context";
import { articleService } from "@/server/services/article.service";
import { categoryService } from "@/server/services/category.service";
import { tagService } from "@/server/services/tag.service";
import { publicSiteService } from "@/server/services/public-site.service";
import { searchService } from "@/server/services/search.service";
import { viewService } from "@/server/services/view.service";
import { ApiError } from "@/lib/api/errors";

const PREFIX = `pub-${Date.now()}`;
const created = { articles: [] as string[], categories: [] as string[], tags: [] as string[] };

function actor(id: string): AuthUser {
  return { id, email: "t@t.t", name: "T", isActive: true, roleKeys: ["SUPER_ADMIN"], permissions: new Set(Object.values(PERMISSIONS)) };
}
let ctx: ServiceContext;
let adminSlug: string;
let categoryId: string;
let categorySlug: string;
let tagId: string;
let tagSlug: string;
let publishedSlug: string;

async function publish(id: string, extra: Record<string, unknown> = {}) {
  await prisma.article.update({ where: { id }, data: { status: "PUBLISHED", publishedAt: new Date(), ...extra } });
}

beforeAll(async () => {
  const admin = await prisma.user.findFirstOrThrow({ where: { deletedAt: null }, include: { profile: true } });
  ctx = { actor: actor(admin.id), ip: null, userAgent: "vitest" };
  adminSlug = admin.profile!.slug;

  const category = await categoryService.create(ctx, { name: `${PREFIX} دسته` });
  categoryId = category.id;
  categorySlug = category.slug;
  created.categories.push(category.id);

  const tag = await tagService.create(ctx, { name: `${PREFIX}-برچسب` });
  tagId = tag.id;
  tagSlug = tag.slug;
  created.tags.push(tag.id);

  // Published article (breaking, tagged, categorised).
  const pub = await articleService.create(ctx, {
    title: `${PREFIX} خبر منتشرشده`,
    summary: `${PREFIX} خلاصه قابل جستجو`,
    primaryCategoryId: categoryId,
    tagIds: [tagId],
  });
  created.articles.push(pub.id);
  await publish(pub.id, { isBreaking: true, viewCount: 999 });
  publishedSlug = pub.slug;

  // Draft, scheduled, future-published, deleted — all must stay private.
  const draft = await articleService.create(ctx, { title: `${PREFIX} پیش‌نویس`, primaryCategoryId: categoryId });
  created.articles.push(draft.id);

  const scheduled = await articleService.create(ctx, { title: `${PREFIX} زمان‌بندی`, primaryCategoryId: categoryId });
  created.articles.push(scheduled.id);
  await prisma.article.update({
    where: { id: scheduled.id },
    data: { status: "SCHEDULED", scheduledAt: new Date(Date.now() + 864e5), publishedAt: new Date(Date.now() + 864e5) },
  });

  const future = await articleService.create(ctx, { title: `${PREFIX} آینده`, primaryCategoryId: categoryId });
  created.articles.push(future.id);
  await prisma.article.update({ where: { id: future.id }, data: { status: "PUBLISHED", publishedAt: new Date(Date.now() + 864e5) } });

  const deleted = await articleService.create(ctx, { title: `${PREFIX} حذف‌شده`, primaryCategoryId: categoryId });
  created.articles.push(deleted.id);
  await prisma.article.update({ where: { id: deleted.id }, data: { status: "PUBLISHED", publishedAt: new Date(), deletedAt: new Date() } });
});

afterAll(async () => {
  await prisma.pageView.deleteMany({ where: { articleId: { in: created.articles } } });
  await prisma.searchLog.deleteMany({ where: { query: { contains: PREFIX } } });
  await prisma.articleTag.deleteMany({ where: { articleId: { in: created.articles } } });
  await prisma.articleCategory.deleteMany({ where: { articleId: { in: created.articles } } });
  await prisma.article.deleteMany({ where: { id: { in: created.articles } } });
  await prisma.tag.deleteMany({ where: { id: { in: created.tags } } });
  await prisma.category.deleteMany({ where: { id: { in: created.categories } } });
  await prisma.$disconnect();
});

describe("article detail visibility", () => {
  it("returns a published article with no internal fields", async () => {
    const { article } = await publicSiteService.articleDetail(publishedSlug);
    expect(article.slug).toBe(publishedSlug);
    expect(article).not.toHaveProperty("factCheckStatus");
    expect(article).not.toHaveProperty("scheduledAt");
    expect(article).not.toHaveProperty("assignedEditorId");
  });

  it("404s for draft, scheduled, future-published and deleted articles", async () => {
    const rows = await prisma.article.findMany({ where: { id: { in: created.articles } }, select: { slug: true, status: true, deletedAt: true } });
    for (const r of rows) {
      const isPublicNow = r.status === "PUBLISHED" && !r.deletedAt && r.slug === publishedSlug;
      if (isPublicNow) continue;
      await expect(publicSiteService.articleDetail(r.slug)).rejects.toBeInstanceOf(ApiError);
    }
  });
});

describe("listings only expose published content", () => {
  it("category page lists the published article only", async () => {
    const { rows } = await publicSiteService.categoryPage(categorySlug, 0, 50);
    const slugs = rows.map((r) => r.slug);
    expect(slugs).toContain(publishedSlug);
    expect(slugs.filter((s) => s.startsWith(PREFIX) || s.includes("پیش"))).toEqual([publishedSlug].filter((s) => slugs.includes(s)));
    expect(rows.length).toBe(1);
    expect(rows[0]).not.toHaveProperty("bodyJson");
  });

  it("tag page lists the published article", async () => {
    const { rows } = await publicSiteService.tagPage(tagSlug, 0, 50);
    expect(rows.map((r) => r.slug)).toEqual([publishedSlug]);
  });

  it("author page lists the published article and hides private data", async () => {
    const { profile, rows } = await publicSiteService.author(adminSlug, 0, 50);
    expect(rows.map((r) => r.slug)).toContain(publishedSlug);
    expect(profile).not.toHaveProperty("userId");
    expect(profile).not.toHaveProperty("email");
  });

  it("breaking listing includes the breaking article", async () => {
    const { rows } = await publicSiteService.breaking(0, 50);
    expect(rows.map((r) => r.slug)).toContain(publishedSlug);
  });

  it("most-viewed (all) ranks the high-viewCount article", async () => {
    const rows = await publicSiteService.mostViewed("all", 50);
    expect(rows.map((r) => r.slug)).toContain(publishedSlug);
  });

  it("news index filters by category and never returns drafts", async () => {
    const { rows, total } = await publicSiteService.newsIndex({ skip: 0, take: 50, categorySlug, sort: "newest" });
    expect(total).toBe(1);
    expect(rows.map((r) => r.slug)).toEqual([publishedSlug]);
  });

  it("category/tag lookups 404 for unknown slugs", async () => {
    await expect(publicSiteService.categoryPage("no-such-cat", 0, 10)).rejects.toBeInstanceOf(ApiError);
    await expect(publicSiteService.tagPage("no-such-tag", 0, 10)).rejects.toBeInstanceOf(ApiError);
    await expect(publicSiteService.author("no-such-author", 0, 10)).rejects.toBeInstanceOf(ApiError);
  });
});

describe("search", () => {
  it("finds the published article by summary text and logs the query", async () => {
    const result = await searchService.search({ q: `${PREFIX} خلاصه`, page: 1, sort: "relevance" });
    expect(result.rows.map((r) => r.slug)).toContain(publishedSlug);
    const log = await prisma.searchLog.findFirst({ where: { query: `${PREFIX} خلاصه` } });
    expect(log).not.toBeNull();
  });

  it("logs zero-result queries too", async () => {
    const q = `${PREFIX}-zzz-none`;
    const result = await searchService.search({ q, page: 1, sort: "newest" });
    expect(result.total).toBe(0);
    const log = await prisma.searchLog.findFirst({ where: { query: q } });
    expect(log?.resultCount).toBe(0);
  });

  it("does not surface drafts in search", async () => {
    const result = await searchService.search({ q: `${PREFIX} پیش‌نویس`, page: 1, sort: "relevance" });
    expect(result.rows.every((r) => r.slug === publishedSlug || !r.slug.includes("پیش"))).toBe(true);
  });

  it("filters published results by public author, category and date", async () => {
    const result = await searchService.search({
      q: `${PREFIX} خلاصه`,
      page: 1,
      sort: "newest",
      author: adminSlug,
      category: categorySlug,
      from: new Date(Date.now() - 86_400_000).toISOString().slice(0, 10),
      to: new Date().toISOString().slice(0, 10),
    });
    expect(result.rows.map((row) => row.slug)).toEqual([publishedSlug]);
  });

  it("returns no rows for a non-matching author filter", async () => {
    const result = await searchService.search({
      q: `${PREFIX} خلاصه`,
      page: 1,
      sort: "relevance",
      author: "no-such-public-author",
    });
    expect(result.total).toBe(0);
  });

  it("provides only public authors with published work for filters", async () => {
    const authors = await publicSiteService.searchAuthors();
    const selected = authors.find((author) => author.slug === adminSlug);
    expect(selected).toBeTruthy();
    expect(selected).not.toHaveProperty("publicEmail");
  });
});

describe("view tracking", () => {
  it("counts once per session, dedups repeats, and ignores bots + drafts", async () => {
    const before = (await prisma.article.findFirstOrThrow({ where: { slug: publishedSlug }, select: { viewCount: true } })).viewCount;

    const first = await viewService.recordView({ slug: publishedSlug, sessionKey: `${PREFIX}-s1`, userAgent: "Chrome", path: "/x" });
    expect(first.counted).toBe(true);

    const dup = await viewService.recordView({ slug: publishedSlug, sessionKey: `${PREFIX}-s1`, userAgent: "Chrome", path: "/x" });
    expect(dup.counted).toBe(false);

    const bot = await viewService.recordView({ slug: publishedSlug, sessionKey: `${PREFIX}-s2`, userAgent: "Googlebot", path: "/x" });
    expect(bot.counted).toBe(false);

    const after = (await prisma.article.findFirstOrThrow({ where: { slug: publishedSlug }, select: { viewCount: true } })).viewCount;
    expect(after).toBe(before + 1);
  });

  it("never counts a view for a non-public article", async () => {
    const draft = await prisma.article.findFirstOrThrow({ where: { id: { in: created.articles }, status: "DRAFT" }, select: { slug: true } });
    const res = await viewService.recordView({ slug: draft.slug, sessionKey: `${PREFIX}-s3`, userAgent: "Chrome", path: "/x" });
    expect(res.counted).toBe(false);
  });
});

describe("static pages", () => {
  it("returns a seeded published page and null for unknown", async () => {
    const about = await publicSiteService.getStaticPage("about");
    expect(about?.title).toBeTruthy();
    expect(about?.bodyJson).toBeTruthy();
    expect(await publicSiteService.getStaticPage("does-not-exist")).toBeNull();
  });
});
