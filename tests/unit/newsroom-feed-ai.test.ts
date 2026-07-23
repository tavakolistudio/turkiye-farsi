import { describe, it, expect } from "vitest";
import { parseFeed, parseXmlFeed, parseJsonFeed } from "@/server/newsroom/fetch/parse-feed";
import { parseXml, XmlError } from "@/server/newsroom/fetch/xml";
import { aiDraftSchema, aiClassificationSchema, aiImportanceSchema } from "@/server/newsroom/ai/schemas";
import { MockAIProvider } from "@/server/newsroom/ai/mock-provider";

const RSS = `<?xml version="1.0"?><rss version="2.0"><channel><title>Feed</title>
<item><title>خبر یک</title><link>https://ex.com/1</link><guid>g1</guid>
<description>خلاصه یک</description><pubDate>Tue, 21 Jul 2026 10:00:00 GMT</pubDate></item>
<item><title>خبر دو</title><link>https://ex.com/2</link><guid>g2</guid></item>
</channel></rss>`;

const ATOM = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>F</title>
<entry><title>عنوان اتم</title><id>a1</id><link href="https://ex.com/a1"/>
<summary>چکیده</summary><updated>2026-07-21T10:00:00Z</updated></entry></feed>`;

const JSONFEED = JSON.stringify({
  version: "https://jsonfeed.org/version/1.1",
  title: "JF",
  items: [{ id: "j1", url: "https://ex.com/j1", title: "عنوان جیسون", summary: "خلاصه", date_published: "2026-07-21T10:00:00Z" }],
});

describe("feed parsing", () => {
  it("parses RSS 2.0", () => {
    const f = parseXmlFeed(RSS);
    expect(f.items).toHaveLength(2);
    expect(f.items[0]).toMatchObject({ externalId: "g1", title: "خبر یک", link: "https://ex.com/1" });
  });
  it("parses Atom 1.0", () => {
    const f = parseXmlFeed(ATOM);
    expect(f.items[0]).toMatchObject({ externalId: "a1", title: "عنوان اتم", link: "https://ex.com/a1" });
  });
  it("parses JSON Feed", () => {
    const f = parseJsonFeed(JSONFEED);
    expect(f.items[0]).toMatchObject({ externalId: "j1", title: "عنوان جیسون" });
  });
  it("auto-detects format via parseFeed", () => {
    expect(parseFeed(JSONFEED, "application/json").items).toHaveLength(1);
    expect(parseFeed(RSS, "application/rss+xml").items).toHaveLength(2);
  });
  it("rejects XXE / DOCTYPE documents", () => {
    const evil = `<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><rss><channel><item><title>&xxe;</title></item></channel></rss>`;
    expect(() => parseXml(evil)).toThrow(XmlError);
  });
  it("handles CDATA safely", () => {
    const f = parseXmlFeed(`<rss><channel><item><title><![CDATA[عنوان و <b>تگ</b>]]></title><guid>c1</guid><link>https://ex.com/c</link></item></channel></rss>`);
    expect(f.items[0].title).toContain("عنوان");
  });
});

describe("AI output validation", () => {
  it("accepts a well-formed draft", () => {
    const ok = aiDraftSchema.parse({ title: "تیتر", summary: "s", body: "b" });
    expect(ok.title).toBe("تیتر");
    expect(ok.isBreakingSuggestion).toBe(false);
  });
  it("rejects a malformed draft (missing required fields)", () => {
    expect(() => aiDraftSchema.parse({ title: "ab" })).toThrow();
  });
  it("clamps importance score range", () => {
    expect(() => aiImportanceSchema.parse({ score: 150 })).toThrow();
    expect(aiImportanceSchema.parse({ score: 50 }).score).toBe(50);
  });
  it("strips unknown keys from classification", () => {
    const c = aiClassificationSchema.parse({ primaryCategorySlug: "x", danger: "rm -rf" } as Record<string, unknown>);
    expect((c as Record<string, unknown>).danger).toBeUndefined();
  });
});

describe("MockAIProvider", () => {
  it("returns schema-valid, deterministic output", async () => {
    const p = new MockAIProvider();
    const r = await p.generatePersianDraft({
      title: "عنوان", excerpt: "خلاصه", sourceName: "s", sourceUrl: "https://ex.com", publishedAt: null,
      availableCategories: [{ slug: "eco", name: "اقتصاد" }], availableTags: [],
    });
    expect(() => aiDraftSchema.parse(r.data)).not.toThrow();
    expect(r.usage.costUsd).toBe(0);
  });
});
