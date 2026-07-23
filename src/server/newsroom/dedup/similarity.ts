import { comparableText } from "../normalize/persian";

/**
 * Text-similarity primitives for fuzzy duplicate detection. Pure, no I/O.
 * Combines token Jaccard (robust to reordering / added words) with normalized
 * Levenshtein (robust to small edits) into a single 0..1 score.
 */

/** Normalized Levenshtein similarity in [0,1]. Uses O(min) memory. */
export function levenshteinRatio(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const dist = levenshtein(a, b);
  return 1 - dist / Math.max(a.length, b.length);
}

export function levenshtein(a: string, b: string): number {
  if (a.length < b.length) [a, b] = [b, a];
  const prev = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + cost);
      diag = tmp;
    }
  }
  return prev[b.length];
}

function tokens(s: string): Set<string> {
  return new Set(comparableText(s).split(" ").filter((t) => t.length > 1));
}

/** Jaccard similarity of the word sets in [0,1]. */
export function jaccard(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 && tb.size === 0) return 1;
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const union = ta.size + tb.size - inter;
  return inter / union;
}

/**
 * Combined title similarity in [0,1]. Compares the normalized comparison forms.
 * Weighted toward token overlap (0.6) plus edit distance (0.4) — headlines that
 * cover the same event but differ in phrasing still score high.
 */
export function titleSimilarity(a: string, b: string): number {
  const ca = comparableText(a);
  const cb = comparableText(b);
  if (!ca || !cb) return 0;
  if (ca === cb) return 1;
  return 0.6 * jaccard(ca, cb) + 0.4 * levenshteinRatio(ca, cb);
}
