import { describe, it, expect } from "vitest";
import {
  sanitizeBodyJson,
  safeContentUrl,
  parseYouTubeId,
  parseInstagramShortcode,
} from "@/lib/editorial/content";

type Doc = { type: string; content?: unknown[] };
const doc = (content: unknown[]) => ({ type: "doc", content });

/** Recursively collect every node `type` present in a sanitized document. */
function types(node: unknown, acc: string[] = []): string[] {
  if (!node || typeof node !== "object") return acc;
  const n = node as { type?: string; content?: unknown[] };
  if (n.type) acc.push(n.type);
  if (Array.isArray(n.content)) n.content.forEach((c) => types(c, acc));
  return acc;
}

describe("safeContentUrl", () => {
  it("allows http(s) and root-relative URLs", () => {
    expect(safeContentUrl("https://example.com/a")).toBe("https://example.com/a");
    expect(safeContentUrl("/uploads/x.jpg")).toBe("/uploads/x.jpg");
  });
  it("rejects javascript:, data: and protocol-relative URLs", () => {
    expect(safeContentUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeContentUrl("data:text/html,<script>")).toBeUndefined();
    expect(safeContentUrl("//evil.com")).toBeUndefined();
  });
});

describe("embed allowlist parsers", () => {
  it("extracts YouTube ids only from allowlisted hosts", () => {
    expect(parseYouTubeId("https://www.youtube.com/watch?v=abcDEF12345")).toBe("abcDEF12345");
    expect(parseYouTubeId("https://youtu.be/abcDEF12345")).toBe("abcDEF12345");
    expect(parseYouTubeId("https://youtube.com/shorts/abcDEF12345")).toBe("abcDEF12345");
    expect(parseYouTubeId("https://evil.com/watch?v=abcDEF12345")).toBeUndefined();
    expect(parseYouTubeId("javascript:alert(1)")).toBeUndefined();
  });
  it("extracts Instagram shortcodes only from allowlisted hosts", () => {
    expect(parseInstagramShortcode("https://www.instagram.com/p/ABc123/")).toBe("ABc123");
    expect(parseInstagramShortcode("https://instagram.com/reel/XYz789/")).toBe("XYz789");
    expect(parseInstagramShortcode("https://evil.com/p/ABc123/")).toBeUndefined();
  });
});

describe("sanitizeBodyJson", () => {
  it("drops unknown/dangerous node types", () => {
    const out = sanitizeBodyJson(
      doc([
        { type: "paragraph", content: [{ type: "text", text: "سالم" }] },
        { type: "script", content: [{ type: "text", text: "alert(1)" }] },
        { type: "iframe", attrs: { src: "https://evil.com" } },
      ]),
    ) as Doc;
    const t = types(out);
    expect(t).toContain("paragraph");
    expect(t).not.toContain("script");
    expect(t).not.toContain("iframe");
  });

  it("strips a javascript: link mark but keeps the text", () => {
    const out = sanitizeBodyJson(
      doc([
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "کلیک",
              marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
            },
          ],
        },
      ]),
    ) as { content: { content: { text: string; marks?: unknown[] }[] }[] };
    const textNode = out.content[0].content[0];
    expect(textNode.text).toBe("کلیک");
    expect(textNode.marks).toBeUndefined();
  });

  it("keeps a safe external link and forces rel/target", () => {
    const out = sanitizeBodyJson(
      doc([
        {
          type: "paragraph",
          content: [{ type: "text", text: "لینک", marks: [{ type: "link", attrs: { href: "https://example.com" } }] }],
        },
      ]),
    ) as { content: { content: { marks: { type: string; attrs: { rel: string; target: string } }[] }[] }[] };
    const mark = out.content[0].content[0].marks[0];
    expect(mark.type).toBe("link");
    expect(mark.attrs.rel).toContain("noopener");
    expect(mark.attrs.target).toBe("_blank");
  });

  it("drops an image with an unsafe src, keeps a safe one", () => {
    const out = sanitizeBodyJson(
      doc([
        { type: "image", attrs: { src: "javascript:alert(1)", alt: "x" } },
        { type: "image", attrs: { src: "https://cdn.example.com/a.jpg", alt: "خوب" } },
      ]),
    ) as Doc;
    const imgs = (out.content ?? []).filter((n) => (n as { type?: string }).type === "image");
    expect(imgs).toHaveLength(1);
  });

  it("accepts an allowlisted YouTube embed and rejects a foreign one", () => {
    const out = sanitizeBodyJson(
      doc([
        { type: "youtube", attrs: { src: "https://www.youtube.com/watch?v=abcDEF12345" } },
        { type: "youtube", attrs: { src: "https://evil.com/watch?v=abcDEF12345" } },
      ]),
    ) as Doc;
    const yts = (out.content ?? []).filter((n) => (n as { type?: string }).type === "youtube");
    expect(yts).toHaveLength(1);
    expect((yts[0] as { attrs: { videoId: string } }).attrs.videoId).toBe("abcDEF12345");
  });

  it("falls back to an empty doc for non-doc input", () => {
    const out = sanitizeBodyJson({ type: "paragraph" }) as Doc;
    expect(out.type).toBe("doc");
  });
});
