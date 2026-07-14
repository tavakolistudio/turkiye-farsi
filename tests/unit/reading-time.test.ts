import { describe, it, expect } from "vitest";
import { countWords, extractText, readingMinutes } from "@/lib/reading-time";

describe("reading-time", () => {
  it("counts words", () => {
    expect(countWords("یک دو سه")).toBe(3);
    expect(countWords("   ")).toBe(0);
  });

  it("extracts text from a TipTap doc", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "سلام" }] },
        { type: "paragraph", content: [{ type: "text", text: "دنیا" }] },
      ],
    };
    expect(extractText(doc).trim()).toContain("سلام");
    expect(extractText(doc).trim()).toContain("دنیا");
  });

  it("returns at least 1 minute", () => {
    expect(readingMinutes("short")).toBe(1);
  });

  it("scales with word count (~200 wpm)", () => {
    const words = Array.from({ length: 400 }, () => "کلمه").join(" ");
    expect(readingMinutes(words)).toBe(2);
  });
});
