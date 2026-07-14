import { describe, it, expect } from "vitest";
import { createArticleSchema } from "@/lib/validations/article";
import { createCategorySchema } from "@/lib/validations/category";
import { createSourceSchema } from "@/lib/validations/source";

describe("article validation", () => {
  it("rejects a too-short title", () => {
    const r = createArticleSchema.safeParse({ title: "خب" });
    expect(r.success).toBe(false);
  });

  it("accepts a valid minimal article and applies defaults", () => {
    const r = createArticleSchema.safeParse({ title: "یک خبر آزمایشی معتبر" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.status).toBe("DRAFT");
      expect(r.data.contentType).toBe("NEWS");
      expect(r.data.noindex).toBe(false);
    }
  });

  it("rejects an over-long meta description", () => {
    const r = createArticleSchema.safeParse({
      title: "عنوان معتبر برای تست",
      metaDescription: "x".repeat(321),
    });
    expect(r.success).toBe(false);
  });

  it("rejects an invalid canonical URL", () => {
    const r = createArticleSchema.safeParse({ title: "عنوان معتبر", canonicalUrl: "not-a-url" });
    expect(r.success).toBe(false);
  });
});

describe("category validation", () => {
  it("rejects a bad slug", () => {
    const r = createCategorySchema.safeParse({ name: "دسته", slug: "bad slug!" });
    expect(r.success).toBe(false);
  });
  it("accepts a valid Persian slug", () => {
    const r = createCategorySchema.safeParse({ name: "دسته", slug: "اقامت-ترکیه" });
    expect(r.success).toBe(true);
  });
});

describe("source validation", () => {
  it("rejects an invalid website URL", () => {
    const r = createSourceSchema.safeParse({ name: "منبع", websiteUrl: "not-a-valid-url" });
    expect(r.success).toBe(false);
  });
  it("defaults sourceType and credibility", () => {
    const r = createSourceSchema.safeParse({ name: "منبع رسمی" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.sourceType).toBe("OTHER");
      expect(r.data.credibilityLevel).toBe("MEDIUM");
    }
  });
});
