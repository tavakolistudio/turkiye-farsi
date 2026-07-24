/**
 * Persian / Arabic text normalization for search and duplicate detection.
 *
 * These are PURE functions with no I/O so they are trivially unit-testable.
 * The DISPLAY title is always kept verbatim elsewhere; the normalized forms
 * produced here are only ever used for hashing, comparison and clustering.
 */

/** Arabic Kaf (ك U+0643) → Persian Keh (ک U+06A9). */
const ARABIC_KAF = /ك/g;
/** Arabic Yeh (ي U+064A) and Alef Maksura (ى U+0649) → Persian Yeh (ی U+06CC). */
const ARABIC_YEH = /[يى]/g;
/** Arabic-Indic and extended digits → ASCII. */
const ARABIC_INDIC = /[٠-٩]/g; // ٠-٩
const PERSIAN_DIGITS = /[۰-۹]/g; // ۰-۹
/** Harakat / tatweel / diacritics that never change meaning for comparison. */
const DIACRITICS = /[ً-ْٰـ]/g;
/** Zero-width characters that leak in from copy-paste and break comparison. */
const BAD_ZERO_WIDTH = /[​‌‍﻿⁠]/g;
/** Broad emoji / pictograph ranges (dropped for comparison only). */
const EMOJI =
  /[←-⇿⌀-➿⬀-⯿︀-️\u{1F000}-\u{1FAFF}]/gu;

/** Convert Arabic-Indic / Persian digits to ASCII 0-9. */
export function normalizeDigits(input: string): string {
  return input
    .replace(ARABIC_INDIC, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(PERSIAN_DIGITS, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/**
 * Canonicalize Persian letters, strip diacritics and bad zero-widths, and
 * collapse whitespace. NFC-normalized. Case-folded (harmless for Persian, helps
 * mixed Latin). Does NOT drop emoji (that is comparison-only, see below).
 */
export function normalizePersian(input: string): string {
  return input
    .normalize("NFC")
    .replace(ARABIC_KAF, "ک")
    .replace(ARABIC_YEH, "ی")
    .replace(DIACRITICS, "")
    .replace(BAD_ZERO_WIDTH, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The comparison form used for hashing and fuzzy matching: fully normalized,
 * digits ASCII, emoji removed, punctuation stripped, lowercased.
 */
export function comparableText(input: string): string {
  return normalizeDigits(normalizePersian(input))
    .replace(EMOJI, "")
    // Strip punctuation (Latin + common Persian) but keep letters, digits, spaces.
    .replace(/[!-/:-@[-`{-~«»؟،؛”“‘’–—…]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    // Turkish capital İ lowercases (per JS's locale-agnostic algorithm) to
    // "i" + a stray combining dot above (U+0307), not plain "i" — strip it so
    // Turkish keyword matching ("İstanbul" vs "istanbul") is reliable.
    .replace(/̇/g, "");
}

/** Known source brand suffixes to peel off a title's tail (e.g. "… - ایسنا"). */
const BRAND_SEPARATORS = /\s*[-–—|•·:]\s*[^-–—|•·:]{1,40}$/;

/**
 * Remove a trailing " - Source Name" style brand tag from a title, but only
 * when a separator + short tail is present. Conservative: never touches a title
 * without a clear trailing separator so real headlines are preserved.
 */
export function stripBrandSuffix(title: string, brand?: string | null): string {
  let out = title.trim();
  if (brand) {
    const b = brand.trim();
    // Exact " - <brand>" / " | <brand>" tail.
    const re = new RegExp(`\\s*[-–—|•·:]\\s*${escapeRegExp(b)}\\s*$`, "i");
    out = out.replace(re, "").trim();
  }
  // Fall back to a single generic trailing tag if still present.
  if (BRAND_SEPARATORS.test(out)) {
    const stripped = out.replace(BRAND_SEPARATORS, "").trim();
    // Only accept if we keep a meaningful headline (avoid over-trimming).
    if (stripped.length >= 12) out = stripped;
  }
  return out;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
