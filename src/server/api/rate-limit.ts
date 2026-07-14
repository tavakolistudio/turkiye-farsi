import "server-only";
import { ApiError } from "@/lib/api/errors";

/**
 * Lightweight in-memory fixed-window rate limiter for public endpoints.
 * Per-process (fine for a single instance / dev); swap for Redis/Upstash when
 * horizontally scaled. Keyed by client IP + bucket name.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  key: string,
  limit = 60,
  windowMs = 60_000,
): { ok: boolean; remaining: number } {
  const now = Date.now();
  const entry = buckets.get(key);
  if (!entry || entry.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1 };
  }
  entry.count += 1;
  return { ok: entry.count <= limit, remaining: Math.max(0, limit - entry.count) };
}

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

/** Enforce a public rate limit for a request; throws ApiError on exhaustion. */
export function enforcePublicRateLimit(req: Request, bucket: string, limit = 60): void {
  const { ok } = rateLimit(`${bucket}:${clientIp(req)}`, limit);
  if (!ok) {
    throw new ApiError("RATE_LIMITED", "تعداد درخواست‌ها بیش از حد مجاز است. کمی بعد تلاش کنید.");
  }
}

// Occasionally clear expired buckets to bound memory.
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of buckets) if (v.resetAt < now) buckets.delete(k);
}, 5 * 60_000).unref?.();
