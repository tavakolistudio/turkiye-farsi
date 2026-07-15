import { describe, it, expect } from "vitest";
import { searchQuerySchema } from "@/server/services/search.service";
import { classifyDevice, isBot } from "@/server/services/view.service";
import { toPersianDigits, formatJalali } from "@/lib/dates";
import { routes } from "@/lib/public-links";

describe("searchQuerySchema", () => {
  it("rejects queries shorter than 2 chars", () => {
    expect(searchQuerySchema.safeParse({ q: "a" }).success).toBe(false);
    expect(searchQuerySchema.safeParse({ q: "" }).success).toBe(false);
  });
  it("accepts a valid query with defaults", () => {
    const r = searchQuerySchema.safeParse({ q: "اقامت" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.page).toBe(1);
      expect(r.data.sort).toBe("relevance");
    }
  });
  it("coerces page and validates sort", () => {
    const r = searchQuerySchema.safeParse({ q: "اقامت", page: "3", sort: "newest" });
    expect(r.success && r.data.page).toBe(3);
    expect(searchQuerySchema.safeParse({ q: "اقامت", sort: "bogus" }).success).toBe(false);
  });
  it("rejects an invalid category slug", () => {
    expect(searchQuerySchema.safeParse({ q: "اقامت", category: "bad slug!" }).success).toBe(false);
  });
});

describe("view device classification", () => {
  it("detects bots", () => {
    expect(isBot("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(isBot("facebookexternalhit/1.1")).toBe(true);
    expect(isBot("Mozilla/5.0 (Windows NT 10.0) Chrome/120")).toBe(false);
  });
  it("classifies device types", () => {
    expect(classifyDevice("Googlebot")).toBe("BOT");
    expect(classifyDevice("Mozilla/5.0 (iPhone; CPU iPhone OS) Mobile/15E148")).toBe("MOBILE");
    expect(classifyDevice("Mozilla/5.0 (iPad; CPU OS) Safari")).toBe("TABLET");
    expect(classifyDevice("Mozilla/5.0 (Windows NT 10.0) Chrome/120")).toBe("DESKTOP");
    expect(classifyDevice("")).toBe("UNKNOWN");
  });
});

describe("date + link helpers", () => {
  it("converts to Persian digits", () => {
    expect(toPersianDigits(1405)).toBe("۱۴۰۵");
    expect(toPersianDigits("12:30")).toBe("۱۲:۳۰");
  });
  it("formats a Jalali date in Persian digits", () => {
    const s = formatJalali(new Date("2026-07-14T00:00:00Z"));
    expect(s).toMatch(/[۰-۹]/);
  });
  it("builds encoded public routes for Persian slugs", () => {
    expect(routes.article("اقامت-ترکیه")).toBe(`/news/${encodeURIComponent("اقامت-ترکیه")}`);
    expect(routes.category("استانبول")).toContain("/category/");
    expect(routes.search("لیر")).toBe(`/search?q=${encodeURIComponent("لیر")}`);
  });
});
