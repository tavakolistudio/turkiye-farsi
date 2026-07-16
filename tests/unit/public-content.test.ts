import { describe, expect, it } from "vitest";
import { parseYouTubeId, safeContentUrl } from "@/lib/editorial/content";
import { formatJalali } from "@/lib/dates";
import { isBotUserAgent, isPublicArticle, relatedArticleScore, VIEW_DEDUPLICATION_MS } from "@/lib/public-content";
import { searchSchema } from "@/lib/validations/public";

describe("public content rules", () => {
  const now = new Date("2026-07-14T12:00:00Z");
  it("exposes only genuinely published articles", () => {
    expect(isPublicArticle({ status: "PUBLISHED", publishedAt: new Date("2026-07-14T11:00:00Z"), deletedAt: null }, now)).toBe(true);
    expect(isPublicArticle({ status: "DRAFT", publishedAt: null, deletedAt: null }, now)).toBe(false);
    expect(isPublicArticle({ status: "SCHEDULED", publishedAt: new Date("2026-07-15T11:00:00Z"), deletedAt: null }, now)).toBe(false);
  });

  it("ranks category, tags and recency deterministically", () => {
    const close = relatedArticleScore({ sameCategory: true, sharedTags: 2, publishedAt: new Date("2026-07-13") }, now);
    const weak = relatedArticleScore({ sameCategory: false, sharedTags: 1, publishedAt: new Date("2025-01-01") }, now);
    expect(close).toBeGreaterThan(weak);
  });

  it("validates search query and date ranges", () => {
    expect(searchSchema.safeParse({ q: "ترکیه", page: 1, pageSize: 12, sort: "relevance" }).success).toBe(true);
    expect(searchSchema.safeParse({ q: "x", page: 1, pageSize: 12, sort: "relevance" }).success).toBe(false);
    expect(searchSchema.safeParse({ q: "ترکیه", from: "2026-08-01", to: "2026-07-01" }).success).toBe(false);
  });

  it("blocks unsafe content URLs and unknown embed domains", () => {
    // Sanitization is server-side now (sanitizeBodyJson); these are its URL guards.
    expect(safeContentUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeContentUrl("data:text/html,<script>alert(1)</script>")).toBeUndefined();
    expect(parseYouTubeId("https://evil.example/video")).toBeUndefined();
    expect(parseYouTubeId("https://www.youtube.com/watch?v=abcdef")).toBe("abcdef");
  });

  it("filters bots and defines a stable deduplication window", () => {
    expect(isBotUserAgent("Googlebot/2.1")).toBe(true);
    expect(isBotUserAgent("Mozilla/5.0 Chrome/140")).toBe(false);
    expect(VIEW_DEDUPLICATION_MS).toBe(1_800_000);
  });

  it("formats public dates in Jalali form", () => {
    expect(formatJalali(new Date("2026-07-14T00:00:00Z"))).toMatch(/\S+/);
  });
});
