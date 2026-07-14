import "server-only";
import { timingSafeEqual } from "node:crypto";

/**
 * Authenticate machine-to-machine requests (cron jobs, webhooks). These are
 * exempt from CSRF/Origin checks — they have no browser Origin — and instead
 * present a shared secret via `Authorization: Bearer <secret>` or `?secret=`.
 * Compared in constant time to avoid timing attacks.
 */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** True if the request carries the correct CRON_SECRET. */
export function isValidCronRequest(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // fail closed when not configured

  const auth = req.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  const url = new URL(req.url);
  const provided = bearer ?? url.searchParams.get("secret") ?? "";
  return provided.length > 0 && safeEqual(provided, secret);
}
