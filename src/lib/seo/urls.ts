import { siteConfig } from "@/lib/site-config";

/**
 * URL helpers for SEO. Every canonical / OG / sitemap / feed URL is built from
 * `NEXT_PUBLIC_SITE_URL` (via siteConfig.url) — the domain is never hardcoded.
 */

/** The site origin without a trailing slash (e.g. https://turkiyefarsi.com). */
export function siteOrigin(): string {
  return siteConfig.url.replace(/\/+$/, "");
}

/**
 * Turn a root-relative path (or already-absolute URL) into an absolute URL on
 * the configured site origin. Returns undefined for empty/invalid input so
 * callers never emit a broken URL into metadata or a feed.
 */
export function absoluteUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  const raw = path.trim();
  if (!raw) return undefined;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("//")) return undefined; // protocol-relative — reject
  try {
    return new URL(raw.startsWith("/") ? raw : `/${raw}`, `${siteOrigin()}/`).toString();
  } catch {
    return undefined;
  }
}

/**
 * Build a canonical URL: absolute, tracking-free, and with any query string
 * dropped unless an explicit allowlist of params is provided (e.g. pagination).
 */
export function canonicalUrl(path: string, allowParams?: Record<string, string | number | undefined>): string {
  const base = absoluteUrl(path) ?? siteOrigin();
  try {
    const url = new URL(base);
    url.search = "";
    if (allowParams) {
      for (const [k, v] of Object.entries(allowParams)) {
        if (v !== undefined && v !== "" && !(k === "page" && Number(v) <= 1)) {
          url.searchParams.set(k, String(v));
        }
      }
    }
    return url.toString();
  } catch {
    return base;
  }
}

/** Absolute OG/Schema image URL, or the site's default OG image as fallback. */
export function ogImageUrl(image?: string | null): string {
  return absoluteUrl(image) ?? absoluteUrl(siteConfig.defaultOgImage) ?? `${siteOrigin()}${siteConfig.defaultOgImage}`;
}
