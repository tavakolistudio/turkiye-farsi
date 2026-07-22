import type { ParsedFeed, ParsedFeedItem } from "../types";
import { parseXml, findChild, findChildren, childText, type XmlNode } from "./xml";

/**
 * Parse RSS 2.0, Atom 1.0 and JSON Feed 1.x into a common ParsedFeed shape.
 * All parsers cap the number of items they return (the caller also caps), and
 * never trust or execute anything from the feed. Pure — no network.
 */

const MAX_ITEMS = 200;

export function parseFeed(body: string, contentType?: string | null): ParsedFeed {
  const trimmed = body.trimStart();
  const looksJson = trimmed.startsWith("{") || /json/i.test(contentType ?? "");
  if (looksJson) return parseJsonFeed(body);
  return parseXmlFeed(body);
}

// ─────────────────────────── XML (RSS/Atom) ───────────────────────────

export function parseXmlFeed(body: string): ParsedFeed {
  const root = parseXml(body);
  const rootName = root.name.replace(/^.*:/, "").toLowerCase();
  if (rootName === "feed") return parseAtom(root);
  // RSS: <rss><channel>… ; or a bare <channel> / RDF.
  const channel = findChild(root, "channel") ?? root;
  return parseRss(channel);
}

function parseRss(channel: XmlNode): ParsedFeed {
  const items = findChildren(channel, "item").slice(0, MAX_ITEMS).map(rssItem);
  return { title: childText(channel, "title"), items: items.filter(Boolean) as ParsedFeedItem[] };
}

function rssItem(node: XmlNode): ParsedFeedItem | null {
  const title = childText(node, "title")?.trim();
  const link = childText(node, "link")?.trim() || findChild(node, "link")?.attrs.href;
  const guid = childText(node, "guid")?.trim();
  const externalId = guid || link || title;
  if (!title || !externalId) return null;
  const summary = childText(node, "description") ?? childText(node, "encoded"); // content:encoded
  const pub = childText(node, "pubDate") ?? childText(node, "date"); // dc:date
  const meta: Record<string, string | string[]> = {};
  const cats = findChildren(node, "category").map((c) => c.text).filter(Boolean);
  if (cats.length) meta.categories = cats;
  return {
    externalId,
    title,
    link: link ?? "",
    summary: summary?.trim(),
    author: childText(node, "creator") ?? childText(node, "author"),
    publishedAt: parseDate(pub),
    meta,
  };
}

function parseAtom(feed: XmlNode): ParsedFeed {
  const entries = findChildren(feed, "entry").slice(0, MAX_ITEMS).map(atomEntry);
  return { title: childText(feed, "title"), items: entries.filter(Boolean) as ParsedFeedItem[] };
}

function atomEntry(node: XmlNode): ParsedFeedItem | null {
  const title = childText(node, "title")?.trim();
  const links = findChildren(node, "link");
  const alt = links.find((l) => l.attrs.rel === "alternate" || !l.attrs.rel);
  const link = (alt ?? links[0])?.attrs.href ?? childText(node, "link");
  const id = childText(node, "id")?.trim();
  const externalId = id || link || title;
  if (!title || !externalId) return null;
  const summary = childText(node, "summary") ?? childText(node, "content");
  const authorNode = findChild(node, "author");
  const author = authorNode ? childText(authorNode, "name") : undefined;
  return {
    externalId,
    title,
    link: link ?? "",
    summary: summary?.trim(),
    author,
    publishedAt: parseDate(childText(node, "published") ?? childText(node, "updated")),
    updatedAt: parseDate(childText(node, "updated")),
  };
}

// ─────────────────────────── JSON Feed ───────────────────────────

export function parseJsonFeed(body: string): ParsedFeed {
  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    throw new Error("invalid JSON feed");
  }
  if (!data || typeof data !== "object") throw new Error("JSON feed is not an object");
  const obj = data as Record<string, unknown>;
  const rawItems = Array.isArray(obj.items) ? obj.items : [];
  const items = rawItems
    .slice(0, MAX_ITEMS)
    .map((it) => jsonItem(it as Record<string, unknown>))
    .filter(Boolean) as ParsedFeedItem[];
  return { title: typeof obj.title === "string" ? obj.title : undefined, items };
}

function jsonItem(it: Record<string, unknown>): ParsedFeedItem | null {
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : undefined);
  const title = str(it.title) ?? str(it.content_text)?.slice(0, 120);
  const link = str(it.url) ?? str(it.external_url);
  const id = str(it.id) ?? link ?? title;
  if (!title || !id) return null;
  const author =
    it.author && typeof it.author === "object"
      ? str((it.author as Record<string, unknown>).name)
      : undefined;
  return {
    externalId: id,
    title,
    link: link ?? "",
    summary: str(it.summary) ?? str(it.content_text),
    author,
    publishedAt: parseDate(str(it.date_published)),
    updatedAt: parseDate(str(it.date_modified)),
  };
}

// ─────────────────────────── helpers ───────────────────────────

export function parseDate(v: string | undefined | null): Date | undefined {
  if (!v) return undefined;
  const d = new Date(v.trim());
  return Number.isNaN(d.getTime()) ? undefined : d;
}
