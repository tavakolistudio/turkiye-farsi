import { describe, it, expect } from "vitest";
import { generateUniqueSlug, safeSlug } from "@/lib/slug";

describe("generateUniqueSlug", () => {
  it("returns the base slug when free", async () => {
    const slug = await generateUniqueSlug("اقامت ترکیه", async () => false);
    expect(slug).toBe("اقامت-ترکیه");
  });

  it("appends a numeric suffix on collision", async () => {
    const taken = new Set(["news", "news-2"]);
    const slug = await generateUniqueSlug("News", async (s) => taken.has(s));
    expect(slug).toBe("news-3");
  });
});

describe("safeSlug never empty", () => {
  it("falls back when input has no slug-able characters", () => {
    expect(safeSlug("!!!").length).toBeGreaterThan(0);
  });
});
