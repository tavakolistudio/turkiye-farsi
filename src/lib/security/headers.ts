/**
 * Security headers, including a nonce-based Content-Security-Policy.
 *
 * The CSP uses per-request nonces + 'strict-dynamic' for scripts (the modern,
 * XSS-resistant approach). Styles allow 'unsafe-inline' because next/font and
 * some libraries inject inline <style> — inline styles are a much lower risk
 * than inline scripts. Images allow https:/data:/blob: so editorial photos and
 * Supabase Storage work; connect-src includes the Supabase URL when configured.
 */
export function buildContentSecurityPolicy(
  nonce: string,
  opts: {
    isDev: boolean;
    supabaseUrl?: string;
    gaEnabled?: boolean;
    plausibleScriptUrl?: string;
  },
): string {
  const { isDev, supabaseUrl, gaEnabled, plausibleScriptUrl } = opts;

  let plausibleOrigin = "";
  if (plausibleScriptUrl) {
    try {
      const url = new URL(plausibleScriptUrl);
      if (url.protocol === "https:") plausibleOrigin = url.origin;
    } catch {
      // Invalid optional analytics configuration is ignored safely.
    }
  }

  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    // Next.js dev / React Refresh require eval.
    isDev ? "'unsafe-eval'" : "",
    gaEnabled ? "https://www.googletagmanager.com" : "",
    plausibleOrigin,
  ].filter(Boolean);

  const connectSrc = [
    "'self'",
    supabaseUrl || "",
    gaEnabled ? "https://www.google-analytics.com" : "",
    gaEnabled ? "https://region1.google-analytics.com" : "",
    plausibleOrigin,
    // Dev websockets for HMR.
    isDev ? "ws:" : "",
    isDev ? "http://localhost:*" : "",
  ].filter(Boolean);

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": scriptSrc,
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", "https:"],
    "font-src": ["'self'", "data:"],
    "connect-src": connectSrc,
    // TipTap embeds (YouTube/Instagram) — forward-compatible with Phase 5.
    "frame-src": [
      "'self'",
      "https://www.youtube.com",
      "https://www.youtube-nocookie.com",
      "https://www.instagram.com",
    ],
    "media-src": ["'self'", "https:", "blob:"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };

  const parts = Object.entries(directives).map(
    ([key, values]) => `${key} ${values.join(" ")}`,
  );
  if (!isDev) parts.push("upgrade-insecure-requests");
  return parts.join("; ");
}

/** Static security headers applied to every response. */
export function staticSecurityHeaders(isDev: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
    "Permissions-Policy":
      "camera=(), microphone=(), geolocation=(), browsing-topics=(), interest-cohort=()",
    "X-DNS-Prefetch-Control": "on",
  };
  // HSTS only in production (never on http://localhost).
  if (!isDev) {
    headers["Strict-Transport-Security"] =
      "max-age=63072000; includeSubDomains; preload";
  }
  return headers;
}
