import { createHash } from "node:crypto";
import type { ParsedFeedItem } from "../types";
import { comparableText, normalizePersian, stripBrandSuffix } from "./persian";
import { canonicalizeUrl } from "./url";
import { stripHtml } from "../security/prompt-safety";

/**
 * Turn a raw ParsedFeedItem into the copyright-safe, comparison-ready shape we
 * persist. Keeps the ORIGINAL display title verbatim; derives normalized fields
 * only for search/dedup. Truncates the excerpt — we never store full bodies.
 */

export interface NormalizedItem {
  externalId: string;
  title: string; // display, verbatim
  sourceUrl: string;
  canonicalUrl: string | null;
  excerpt: string | null;
  authorName: string | null;
  publishedAt: Date | null;
  originalLanguage: string | null;
  normalizedTitle: string;
  normalizedText: string;
  titleHash: string;
  contentHash: string;
  rawMetadataJson: Record<string, unknown> | null;
}

export interface NormalizeInput {
  item: ParsedFeedItem;
  sourceBrand?: string | null;
  maxExcerptLength: number;
}

export function normalizeItem({ item, sourceBrand, maxExcerptLength }: NormalizeInput): NormalizedItem {
  const displayTitle = normalizePersian(stripBrandSuffix(item.title, sourceBrand)) || item.title.trim();
  const sourceUrl = item.link?.trim() || "";
  const canonicalUrl = canonicalizeUrl(sourceUrl);

  const plainSummary = item.summary ? stripHtml(item.summary) : "";
  const excerptLimit = clampExcerptLen(maxExcerptLength);
  const excerpt = plainSummary ? truncate(normalizePersian(plainSummary), excerptLimit) : null;

  const normalizedTitle = comparableText(displayTitle);
  const normalizedText = comparableText(`${displayTitle} ${plainSummary}`).slice(0, 2000);

  return {
    externalId: item.externalId.trim(),
    title: displayTitle,
    sourceUrl,
    canonicalUrl,
    excerpt,
    authorName: item.author?.trim() ? normalizePersian(item.author).slice(0, 120) : null,
    publishedAt: item.publishedAt ?? null,
    originalLanguage: detectLanguage(`${displayTitle} ${plainSummary}`),
    normalizedTitle,
    normalizedText,
    titleHash: sha256(normalizedTitle),
    // Content hash keyed on canonical URL when present (most reliable), else
    // the normalized title — makes exact re-ingests idempotent.
    contentHash: sha256(canonicalUrl ?? normalizedTitle),
    rawMetadataJson: sanitizeMeta(item.meta),
  };
}

function clampExcerptLen(n: number): number {
  if (!Number.isFinite(n)) return 400;
  return Math.max(80, Math.min(1000, Math.round(n)));
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max).replace(/\s+\S*$/, "").trim() + "…";
}

export function sha256(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

/** Very coarse script-based language guess (fa/ar/tr/en). Comparison-only. */
export function detectLanguage(text: string): string | null {
  const persianOnly = /[پچژگ]/.test(text); // letters unique to Persian
  const arabicBlock = /[؀-ۿ]/.test(text);
  if (arabicBlock) return persianOnly ? "fa" : "fa"; // default fa for our sources
  const turkish = /[ışğİ]/i.test(text) || /\b(ve|için|ile|bir)\b/i.test(text);
  if (turkish) return "tr";
  if (/[a-z]/i.test(text)) return "en";
  return null;
}

/** Keep only small, non-sensitive string/string[] metadata fields. */
function sanitizeMeta(meta?: Record<string, string | string[]>): Record<string, unknown> | null {
  if (!meta) return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (Array.isArray(v)) {
      const arr = v.filter((x) => typeof x === "string").slice(0, 12).map((x) => x.slice(0, 120));
      if (arr.length) out[k.slice(0, 40)] = arr;
    } else if (typeof v === "string") {
      out[k.slice(0, 40)] = v.slice(0, 200);
    }
  }
  return Object.keys(out).length ? out : null;
}
