import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { PERMISSIONS } from "@/server/rbac/permissions";
import type { AuthUser } from "@/server/rbac/authz";
import type { ServiceContext } from "@/server/services/context";
import { categoryService } from "@/server/services/category.service";
import { tagService } from "@/server/services/tag.service";
import { sourceService } from "@/server/services/source.service";
import { articleService } from "@/server/services/article.service";
import { articleLinksService } from "@/server/services/article-links.service";
import { publicContentService } from "@/server/services/public-content.service";
import { AuthorizationError } from "@/server/auth/errors";
import { ApiError } from "@/lib/api/errors";

const PREFIX = `itc-${Date.now()}`;
const created = { articles: [] as string[], categories: [] as string[], tags: [] as string[], sources: [] as string[], media: [] as string[] };

function actor(id: string, perms: string[]): AuthUser {
  return { id, email: "t@t.t", name: "T", isActive: true, roleKeys: ["SUPER_ADMIN"], permissions: new Set(perms) };
}
let ctx: ServiceContext; // full-permission admin
let viewerCtx: ServiceContext; // only view permissions

beforeAll(async () => {
  const admin = await prisma.user.findFirstOrThrow({ where: { deletedAt: null } });
  ctx = { actor: actor(admin.id, Object.values(PERMISSIONS)), ip: null, userAgent: "vitest" };
  viewerCtx = { actor: actor(admin.id, [PERMISSIONS.ARTICLE_VIEW]), ip: null, userAgent: "vitest" };
});

afterAll(async () => {
  await prisma.articleSource.deleteMany({ where: { articleId: { in: created.articles } } });
  await prisma.articleMedia.deleteMany({ where: { articleId: { in: created.articles } } });
  await prisma.articleTag.deleteMany({ where: { articleId: { in: created.articles } } });
  await prisma.articleCategory.deleteMany({ where: { articleId: { in: created.articles } } });
  await prisma.article.deleteMany({ where: { id: { in: created.articles } } });
  await prisma.media.deleteMany({ where: { id: { in: created.media } } });
  await prisma.tag.deleteMany({ where: { id: { in: created.tags } } });
  await prisma.source.deleteMany({ where: { id: { in: created.sources } } });
  await prisma.category.deleteMany({ where: { id: { in: created.categories } } });
  await prisma.$disconnect();
});

describe("Category service", () => {
  it("creates a category and prevents circular parenting", async () => {
    const parent = await categoryService.create(ctx, { name: `${PREFIX} والد` });
    const child = await categoryService.create(ctx, { name: `${PREFIX} فرزند`, parentId: parent.id });
    created.categories.push(parent.id, child.id);
    expect(child.parentId).toBe(parent.id);

    // Making the parent a child of its own child must be rejected.
    await expect(categoryService.update(ctx, parent.id, { parentId: child.id })).rejects.toBeInstanceOf(ApiError);
  });

  it("denies creation without permission", async () => {
    await expect(categoryService.create(viewerCtx, { name: `${PREFIX} x` })).rejects.toBeInstanceOf(AuthorizationError);
  });
});

describe("Tag service", () => {
  it("creates, prevents duplicates, and merges", async () => {
    const t1 = await tagService.create(ctx, { name: `${PREFIX}-tagA` });
    const t2 = await tagService.create(ctx, { name: `${PREFIX}-tagB` });
    created.tags.push(t1.id, t2.id);

    await expect(tagService.create(ctx, { name: `${PREFIX}-tagA` })).rejects.toBeInstanceOf(ApiError);

    const merged = await tagService.merge(ctx, t1.id, t2.id);
    expect(merged.id).toBe(t2.id);
    const src = await prisma.tag.findUnique({ where: { id: t1.id } });
    expect(src?.deletedAt).not.toBeNull();
  });
});

describe("Article + Source + Media relations", () => {
  it("creates an article linked to category, tag, source and media", async () => {
    const category = await categoryService.create(ctx, { name: `${PREFIX} cat` });
    const tag = await tagService.create(ctx, { name: `${PREFIX}-t` });
    const source = await sourceService.create(ctx, { name: `${PREFIX} source` });
    created.categories.push(category.id);
    created.tags.push(tag.id);
    created.sources.push(source.id);

    const media = await prisma.media.create({
      data: {
        filename: `${PREFIX}.jpg`, originalFilename: "x.jpg", storagePath: `uploads/${PREFIX}.jpg`,
        publicUrl: `/uploads/${PREFIX}.jpg`, mimeType: "image/jpeg", size: 1000,
      },
    });
    created.media.push(media.id);

    const article = await articleService.create(ctx, {
      title: `${PREFIX} مقاله آزمایشی`,
      primaryCategoryId: category.id,
      tagIds: [tag.id],
      featuredImageId: media.id,
      status: "DRAFT",
    });
    created.articles.push(article.id);
    expect(article.primaryCategoryId).toBe(category.id);
    expect(article.tags.length).toBe(1);
    expect(article.featuredImageId).toBe(media.id);

    // Attach source + media.
    await articleLinksService.attachSource(ctx, article.id, { sourceId: source.id, isPrimary: true });
    await articleLinksService.attachMedia(ctx, article.id, { mediaId: media.id, role: "GALLERY", order: 0 });
    const withRels = await articleService.getById(ctx, article.id);
    expect(withRels.sources.length).toBe(1);
    expect(withRels.media.length).toBe(1);
    expect(withRels.sourceStatus).toBe("ADDED");
  });

  it("updates, soft-deletes and restores an article", async () => {
    const article = await articleService.create(ctx, { title: `${PREFIX} برای حذف` });
    created.articles.push(article.id);

    const updated = await articleService.update(ctx, article.id, { title: `${PREFIX} ویرایش‌شده`, version: article.currentVersion });
    expect(updated.title).toContain("ویرایش‌شده");

    await articleService.softDelete(ctx, article.id);
    expect((await prisma.article.findUnique({ where: { id: article.id } }))?.deletedAt).not.toBeNull();

    await articleService.restore(ctx, article.id);
    expect((await prisma.article.findUnique({ where: { id: article.id } }))?.deletedAt).toBeNull();
  });

  it("locks the slug after publication", async () => {
    const a = await articleService.create(ctx, { title: `${PREFIX} منتشر`, slug: `${PREFIX}-pub` });
    created.articles.push(a.id);
    await prisma.article.update({ where: { id: a.id }, data: { status: "PUBLISHED", publishedAt: new Date() } });
    await expect(articleService.update(ctx, a.id, { slug: `${PREFIX}-new`, version: a.currentVersion })).rejects.toBeInstanceOf(ApiError);
  });
});

describe("Public content API", () => {
  it("returns only PUBLISHED articles", async () => {
    const draft = await articleService.create(ctx, { title: `${PREFIX} پیش‌نویس عمومی`, status: "DRAFT" });
    const pub = await articleService.create(ctx, { title: `${PREFIX} منتشر عمومی` });
    created.articles.push(draft.id, pub.id);
    await prisma.article.update({ where: { id: pub.id }, data: { status: "PUBLISHED", publishedAt: new Date() } });

    const { rows } = await publicContentService.listArticles({
      page: 1, pageSize: 100, order: "desc", includeDeleted: false, search: PREFIX,
    });
    const slugs = rows.map((r) => r.slug);
    expect(slugs).toContain(pub.slug);
    expect(slugs).not.toContain(draft.slug);
    // Public payload must not leak internal fields.
    expect(rows[0]).not.toHaveProperty("factCheckStatus");
    expect(rows[0]).not.toHaveProperty("scheduledAt");
  });
});
