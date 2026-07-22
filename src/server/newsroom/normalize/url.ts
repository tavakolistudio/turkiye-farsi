/**
 * URL canonicalization. Strips tracking parameters and normalizes the shape of
 * a URL so the same article from different links produces one canonical form
 * (used as a Level-1 duplicate key). Pure, no network.
 */

/** Tracking / campaign parameters removed from every stored URL. */
const TRACKING_PARAMS = [
  /^utm_/i,
  /^fbclid$/i,
  /^gclid$/i,
  /^dclid$/i,
  /^gclsrc$/i,
  /^msclkid$/i,
  /^mc_(cid|eid)$/i,
  /^igshid$/i,
  /^ref$/i,
  /^ref_src$/i,
  /^ref_url$/i,
  /^spm$/i,
  /^yclid$/i,
  /^_hsenc$/i,
  /^_hsmi$/i,
  /^vero_/i,
  /^wt_/i,
  /^cmpid$/i,
  /^campaign$/i,
  /^source$/i,
];

function isTracking(key: string): boolean {
  return TRACKING_PARAMS.some((re) => re.test(key));
}

/**
 * Return a canonical, tracking-free absolute URL, or null if the input is not a
 * usable http(s) URL. Lowercases host, drops default ports, removes the
 * fragment, sorts remaining query params for stability, trims a trailing slash.
 */
export function canonicalizeUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;

  u.hash = "";
  u.hostname = u.hostname.toLowerCase();
  // Drop default ports.
  if (
    (u.protocol === "http:" && u.port === "80") ||
    (u.protocol === "https:" && u.port === "443")
  ) {
    u.port = "";
  }

  const kept: [string, string][] = [];
  for (const [k, v] of u.searchParams.entries()) {
    if (!isTracking(k)) kept.push([k, v]);
  }
  kept.sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])));
  u.search = "";
  for (const [k, v] of kept) u.searchParams.append(k, v);

  // Normalize a lone trailing slash on the path (but keep root "/").
  if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
    u.pathname = u.pathname.replace(/\/+$/, "");
  }

  return u.toString();
}
