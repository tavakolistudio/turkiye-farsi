/**
 * Open-redirect prevention. Only allow same-site, path-only redirect targets.
 * Rejects absolute URLs (http://evil.com), protocol-relative (//evil.com),
 * and backslash tricks. Falls back to a safe default.
 */
export function safeRedirect(
  target: string | null | undefined,
  fallback = "/admin",
): string {
  if (!target) return fallback;

  // Must start with a single "/" and not "//" or "/\" (protocol-relative).
  if (!target.startsWith("/")) return fallback;
  if (target.startsWith("//") || target.startsWith("/\\")) return fallback;

  // Reject anything that parses as an absolute URL with a host.
  try {
    // Using a dummy base: a path-only value keeps the dummy origin.
    const url = new URL(target, "http://localhost");
    if (url.origin !== "http://localhost") return fallback;
    // Reconstruct path + search + hash only (drops any injected origin).
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
