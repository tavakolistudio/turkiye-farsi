import type { Prisma } from "@prisma/client";

type JsonRecord = Record<string, unknown>;

const CONTAINER_NODES = new Set([
  "doc", "paragraph", "heading", "bulletList", "orderedList", "listItem", "blockquote",
  "table", "tableRow", "tableHeader", "tableCell", "callout", "warning", "infoBox",
  "sourceBox", "faq",
]);
const LEAF_NODES = new Set([
  "text", "hardBreak", "horizontalRule", "image", "gallery", "video", "relatedArticle",
  "advertisement", "fileAttachment", "youtube", "instagram",
]);
const MARKS = new Set(["bold", "italic", "strike", "code", "link"]);
const MAX_NODES = 5_000;
const MAX_DEPTH = 30;
const MAX_TEXT = 100_000;

function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value: unknown, max = 10_000): string | undefined {
  if (typeof value !== "string") return undefined;
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").slice(0, max);
}

export function safeContentUrl(value: unknown): string | undefined {
  const raw = cleanText(value, 2_000)?.trim();
  if (!raw) return undefined;
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

/** Allowlisted embed hosts. Anything else is rejected outright. */
const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtu.be"]);
const INSTAGRAM_HOSTS = new Set(["instagram.com", "www.instagram.com"]);

/** Extract a YouTube video id from a watch/short/embed URL (allowlist only). */
export function parseYouTubeId(value: unknown): string | undefined {
  const raw = cleanText(value, 2_000)?.trim();
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    if (!YOUTUBE_HOSTS.has(url.hostname)) return undefined;
    let id: string | null = null;
    if (url.hostname.endsWith("youtu.be")) id = url.pathname.slice(1);
    else if (url.pathname === "/watch") id = url.searchParams.get("v");
    else if (url.pathname.startsWith("/embed/")) id = url.pathname.split("/")[2] ?? null;
    else if (url.pathname.startsWith("/shorts/")) id = url.pathname.split("/")[2] ?? null;
    if (id && /^[a-zA-Z0-9_-]{6,20}$/.test(id)) return id;
  } catch {
    /* fall through */
  }
  return undefined;
}

/** Extract an Instagram post/reel/tv shortcode (allowlist only). */
export function parseInstagramShortcode(value: unknown): string | undefined {
  const raw = cleanText(value, 2_000)?.trim();
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return undefined;
    if (!INSTAGRAM_HOSTS.has(url.hostname)) return undefined;
    const m = url.pathname.match(/^\/(?:p|reel|tv)\/([a-zA-Z0-9_-]{1,30})/);
    if (m) return m[1];
  } catch {
    /* fall through */
  }
  return undefined;
}

function sanitizeAttrs(type: string, attrs: unknown): JsonRecord | undefined {
  const a = isRecord(attrs) ? attrs : {};
  const out: JsonRecord = {};
  if (type === "heading") out.level = [2, 3, 4].includes(Number(a.level)) ? Number(a.level) : 2;
  if (["image", "video"].includes(type)) {
    const src = safeContentUrl(a.src);
    if (!src) return undefined;
    out.src = src;
    const alt = cleanText(a.alt, 500);
    const title = cleanText(a.title, 500);
    if (alt) out.alt = alt;
    if (title) out.title = title;
  }
  if (type === "gallery") {
    const images = Array.isArray(a.images)
      ? a.images.slice(0, 50).flatMap((item) => {
          if (!isRecord(item)) return [];
          const src = safeContentUrl(item.src);
          if (!src) return [];
          return [{ src, alt: cleanText(item.alt, 500) ?? "", caption: cleanText(item.caption, 1_000) ?? "" }];
        })
      : [];
    if (!images.length) return undefined;
    out.images = images;
  }
  if (type === "relatedArticle") {
    const articleId = cleanText(a.articleId, 100);
    if (!articleId) return undefined;
    out.articleId = articleId;
    out.title = cleanText(a.title, 500) ?? "";
  }
  if (type === "advertisement") {
    const placement = cleanText(a.placement, 100);
    if (!placement) return undefined;
    out.placement = placement;
  }
  if (type === "youtube") {
    const videoId = parseYouTubeId(a.src) ?? parseYouTubeId(a.url);
    if (!videoId) return undefined;
    out.videoId = videoId;
    const title = cleanText(a.title, 300);
    if (title) out.title = title;
  }
  if (type === "instagram") {
    const shortcode = parseInstagramShortcode(a.src) ?? parseInstagramShortcode(a.url);
    if (!shortcode) return undefined;
    out.shortcode = shortcode;
    const title = cleanText(a.title, 300);
    if (title) out.title = title;
  }
  if (type === "fileAttachment") {
    const url = safeContentUrl(a.url);
    if (!url) return undefined;
    out.url = url;
    out.name = cleanText(a.name, 500) ?? "فایل پیوست";
    out.mimeType = cleanText(a.mimeType, 200) ?? "application/octet-stream";
  }
  if (["callout", "warning", "infoBox", "sourceBox", "faq"].includes(type)) {
    const title = cleanText(a.title, 500);
    if (title) out.title = title;
  }
  return Object.keys(out).length ? out : undefined;
}

function sanitizeMarks(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  const marks = value.flatMap((mark) => {
    if (!isRecord(mark) || typeof mark.type !== "string" || !MARKS.has(mark.type)) return [];
    if (mark.type !== "link") return [{ type: mark.type }];
    const href = safeContentUrl(isRecord(mark.attrs) ? mark.attrs.href : undefined);
    if (!href) return [];
    return [{ type: "link", attrs: { href, target: "_blank", rel: "noopener noreferrer nofollow" } }];
  });
  return marks.length ? marks : undefined;
}

export function sanitizeBodyJson(value: unknown): Prisma.InputJsonValue {
  let nodes = 0;
  let textLength = 0;
  function visit(input: unknown, depth: number): JsonRecord | null {
    if (!isRecord(input) || depth > MAX_DEPTH || ++nodes > MAX_NODES) return null;
    const type = typeof input.type === "string" ? input.type : "";
    if (!CONTAINER_NODES.has(type) && !LEAF_NODES.has(type)) return null;
    if (type === "text") {
      const remaining = MAX_TEXT - textLength;
      const text = cleanText(input.text, Math.max(0, remaining));
      if (!text) return null;
      textLength += text.length;
      const marks = sanitizeMarks(input.marks);
      return { type, text, ...(marks ? { marks } : {}) };
    }
    const attrs = sanitizeAttrs(type, input.attrs);
    if (
      ["image", "gallery", "video", "relatedArticle", "advertisement", "fileAttachment", "youtube", "instagram"].includes(type) &&
      !attrs
    ) {
      return null;
    }
    const content = Array.isArray(input.content)
      ? input.content.map((child) => visit(child, depth + 1)).filter((child): child is JsonRecord => !!child)
      : [];
    return { type, ...(attrs ? { attrs } : {}), ...(content.length ? { content } : {}) };
  }
  const root = visit(value, 0);
  if (!root || root.type !== "doc") return { type: "doc", content: [{ type: "paragraph" }] };
  return root as Prisma.InputJsonValue;
}

export function bodyJsonText(value: unknown): string {
  if (!isRecord(value)) return "";
  const own = value.type === "text" && typeof value.text === "string" ? value.text : "";
  const children = Array.isArray(value.content) ? value.content.map(bodyJsonText).filter(Boolean).join(" ") : "";
  return `${own} ${children}`.trim();
}
