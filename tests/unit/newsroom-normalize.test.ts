import { describe, it, expect } from "vitest";
import { normalizePersian, normalizeDigits, comparableText, stripBrandSuffix } from "@/server/newsroom/normalize/persian";
import { canonicalizeUrl } from "@/server/newsroom/normalize/url";
import { normalizeItem, sha256, detectLanguage } from "@/server/newsroom/normalize/normalization.service";
import type { ParsedFeedItem } from "@/server/newsroom/types";

describe("Persian normalization", () => {
  it("converts Arabic kaf/yeh to Persian", () => {
    expect(normalizePersian("كتاب يك")).toBe("کتاب یک");
  });
  it("normalizes Arabic-Indic and Persian digits to ASCII", () => {
    expect(normalizeDigits("۱۲۳ ٤٥٦")).toBe("123 456");
  });
  it("strips zero-width characters and collapses spaces", () => {
    expect(normalizePersian("سلام‌دنیا   x")).toBe("سلامدنیا x");
  });
  it("comparableText lowercases, drops punctuation and emoji", () => {
    const a = comparableText("خبر: افزایش! قیمت 😀 LIRA");
    expect(a).not.toMatch(/[!:😀]/);
    expect(a).toContain("قیمت");
    expect(a).toContain("lira");
  });
  it("strips a trailing brand suffix but keeps real headlines", () => {
    expect(stripBrandSuffix("افزایش قیمت لیر - ایسنا", "ایسنا")).toBe("افزایش قیمت لیر");
    expect(stripBrandSuffix("یک خبر بدون برند")).toBe("یک خبر بدون برند");
  });
});

describe("URL canonicalization", () => {
  it("removes tracking params and sorts the rest", () => {
    const u = canonicalizeUrl("https://Example.com/News?utm_source=x&b=2&a=1&fbclid=zzz#frag");
    expect(u).toBe("https://example.com/News?a=1&b=2");
  });
  it("drops default ports and trailing slash", () => {
    expect(canonicalizeUrl("https://example.com:443/path/")).toBe("https://example.com/path");
  });
  it("rejects non-http protocols", () => {
    expect(canonicalizeUrl("javascript:alert(1)")).toBeNull();
    expect(canonicalizeUrl("ftp://example.com")).toBeNull();
  });
});

describe("hashing + language + item normalization", () => {
  it("sha256 is deterministic", () => {
    expect(sha256("abc")).toBe(sha256("abc"));
    expect(sha256("abc")).not.toBe(sha256("abd"));
  });
  it("detects Persian vs Turkish vs English", () => {
    expect(detectLanguage("افزایش قیمت پژو")).toBe("fa");
    expect(detectLanguage("bir haber için")).toBe("tr");
    expect(detectLanguage("hello world")).toBe("en");
  });
  it("normalizeItem truncates excerpt and never keeps HTML", () => {
    const item: ParsedFeedItem = {
      externalId: "id-1",
      title: "خبر تازه <b>مهم</b> - منبع",
      link: "https://ex.com/a?utm_source=x",
      summary: "<p>متن خلاصه با <script>bad()</script> تگ</p>",
    };
    const n = normalizeItem({ item, sourceBrand: "منبع", maxExcerptLength: 100 });
    expect(n.excerpt).not.toMatch(/<|script|bad\(/);
    expect(n.canonicalUrl).toBe("https://ex.com/a");
    expect(n.titleHash).toHaveLength(64);
    expect(n.contentHash).toHaveLength(64);
    expect(n.title).not.toContain("منبع"); // brand stripped
  });
});
