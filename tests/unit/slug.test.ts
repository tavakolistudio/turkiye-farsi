import { describe, it, expect } from "vitest";
import { slugify, uniqueSlug } from "@/lib/slug";

describe("slugify", () => {
  it("keeps Persian letters and hyphenates spaces", () => {
    expect(slugify("اقامت ترکیه")).toBe("اقامت-ترکیه");
  });

  it("lowercases and hyphenates Latin text", () => {
    expect(slugify("New Law 2026")).toBe("new-law-2026");
  });

  it("normalizes Arabic Yeh/Kaf to Persian", () => {
    expect(slugify("كتاب ي")).toBe("کتاب-ی");
  });

  it("collapses repeated separators and trims", () => {
    expect(slugify("  a   b  ")).toBe("a-b");
    expect(slugify("a---b")).toBe("a-b");
  });

  it("uniqueSlug appends a suffix", () => {
    expect(uniqueSlug("اقامت ترکیه", 2)).toBe("اقامت-ترکیه-2");
  });
});
