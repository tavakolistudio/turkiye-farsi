import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { publicContentService } from "@/server/services/public-content.service";

describe("public content integration", () => {
  let published: Prisma.ArticleGetPayload<{ include: { primaryCategory: true; tags: { include: { tag: true } }; author: { include: { profile: true } } } }>;
  let draftId = "";
  const draftSlug = `public-draft-${Date.now()}`;
  const viewPath = `/news/public-view-${Date.now()}`;

  beforeAll(async () => {
    published = await prisma.article.findFirstOrThrow({
      where: { status: "PUBLISHED", deletedAt: null, publishedAt: { not: null } },
      include: { primaryCategory: true, tags: { include: { tag: true } }, author: { include: { profile: true } } },
    });
    const draft = await prisma.article.create({ data: { title: "پیش‌نویس عمومی نیست", slug: draftSlug, status: "DRAFT", authorId: published.authorId } });
    draftId = draft.id;
  });

  afterAll(async () => {
    await prisma.pageView.deleteMany({ where: { path: viewPath } });
    await prisma.searchLog.deleteMany({ where: { query: published.title.slice(0, 4) } });
    if (draftId) await prisma.article.delete({ where: { id: draftId } });
  });

  it("returns a published article and rejects a draft slug", async () => {
    await expect(publicContentService.getArticleBySlug(published.slug)).resolves.toMatchObject({ id: published.id });
    await expect(publicContentService.getArticleBySlug(draftSlug)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("lists published category, tag and author articles", async () => {
    if (published.primaryCategory) {
      const category = await publicContentService.articlesByCategory(published.primaryCategory.slug, { page: 1, pageSize: 10 });
      expect(category.rows.some((item) => item.id === published.id)).toBe(true);
    }
    const firstTag = published.tags[0]?.tag;
    if (firstTag) {
      const tag = await publicContentService.articlesByTag(firstTag.slug, { page: 1, pageSize: 10 });
      expect(tag.rows.some((item) => item.id === published.id)).toBe(true);
    }
    if (published.author.profile) {
      const author = await publicContentService.articlesByAuthor(published.author.profile.slug, { page: 1, pageSize: 10 });
      expect(author.rows.some((item) => item.id === published.id)).toBe(true);
    }
  });

  it("searches public fields and records the query", async () => {
    const q = published.title.slice(0, 4);
    const result = await publicContentService.search({ q, page: 1, pageSize: 20, sort: "relevance" });
    expect(result.rows.some((item) => item.id === published.id)).toBe(true);
    await expect(prisma.searchLog.count({ where: { query: q } })).resolves.toBeGreaterThan(0);
  });

  it("deduplicates views per session and feeds most-viewed", async () => {
    const before = await prisma.article.findUniqueOrThrow({ where: { id: published.id }, select: { viewCount: true } });
    const first = await publicContentService.recordView({ articleId: published.id, sessionKey: "integration-session", path: viewPath, userAgent: "Mozilla/5.0" });
    const second = await publicContentService.recordView({ articleId: published.id, sessionKey: "integration-session", path: viewPath, userAgent: "Mozilla/5.0" });
    expect(first.counted).toBe(true);
    expect(second.counted).toBe(false);
    const after = await prisma.article.findUniqueOrThrow({ where: { id: published.id }, select: { viewCount: true } });
    expect(after.viewCount).toBe(before.viewCount + 1);
    const viewed = await publicContentService.mostViewed("today", { page: 1, pageSize: 20 });
    expect(viewed.rows.some((item) => item.id === published.id)).toBe(true);
  });

  it("returns only published breaking and related articles", async () => {
    const breaking = await publicContentService.listBreaking({ page: 1, pageSize: 20 });
    expect(breaking.rows.every((item) => item.isBreaking)).toBe(true);
    const related = await publicContentService.getRelated(published.slug, 6);
    expect(related.every((item) => item.id !== published.id)).toBe(true);
  });
});
