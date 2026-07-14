import "server-only";
import { headers } from "next/headers";

/** Best-effort client IP + User-Agent from request headers (for audit/rate-limit). */
export async function getRequestMeta(): Promise<{
  ip: string | null;
  userAgent: string | null;
}> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  const userAgent = h.get("user-agent");
  return { ip, userAgent };
}
