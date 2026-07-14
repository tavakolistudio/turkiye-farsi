/**
 * SEO-friendly slug generation that preserves Persian/Arabic letters.
 * "اقامت ترکیه" -> "اقامت-ترکیه", "New Law 2026" -> "new-law-2026".
 */
export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    // normalise Arabic Yeh/Kaf to Persian
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    // remove Arabic diacritics
    .replace(/[ً-ْ]/g, "")
    // whitespace & underscores -> hyphen
    .replace(/[\s_]+/g, "-")
    // keep letters (incl. Persian/Arabic range), digits and hyphen
    .replace(/[^a-z0-9؀-ۿ-]/g, "")
    // collapse multiple hyphens
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Slugify but never return an empty string (which would break unique URLs).
 * Falls back to a short random token when the input has no slug-able chars.
 */
export function safeSlug(input: string, fallbackSeed = ""): string {
  const s = slugify(input);
  if (s) return s;
  const base = slugify(fallbackSeed);
  if (base) return base;
  return `n-${Math.random().toString(36).slice(2, 8)}`;
}

/** Append a short suffix to disambiguate a colliding slug. */
export function uniqueSlug(base: string, suffix: string | number): string {
  return `${slugify(base)}-${suffix}`;
}

/**
 * Generate a slug unique against an async existence check. Tries the base,
 * then base-2, base-3, ... Used by services so the DAL stays declarative.
 * `currentId` lets an entity keep its own slug on update.
 */
export async function generateUniqueSlug(
  desired: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  const base = safeSlug(desired);
  if (!(await exists(base))) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}-${i}`;
    if (!(await exists(candidate))) return candidate;
  }
  // Extremely unlikely fallback.
  return `${base}-${Date.now()}`;
}
