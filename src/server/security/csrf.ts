import "server-only";
import { headers } from "next/headers";
import { CsrfError } from "@/server/auth/errors";

/**
 * CSRF defense for state-changing Server Actions and Route Handlers.
 *
 * We do NOT rely on SameSite cookies alone. Every mutating action verifies that
 * the request's Origin matches the Host it was sent to. Cross-site form posts
 * carry an attacker-controlled Origin (or none for cross-site), so a mismatch
 * or a missing Origin on a POST is rejected.
 *
 * Webhooks/cron are exempt from this check by design — they are called by
 * third parties with no browser Origin — and instead authenticate with a shared
 * secret / signature (see ./cron.ts).
 */
export async function assertSameOrigin(): Promise<void> {
  const h = await headers();
  const origin = h.get("origin");
  const host = h.get("x-forwarded-host") ?? h.get("host");

  if (!host) throw new CsrfError();

  // A same-origin browser POST always includes an Origin header.
  if (!origin) throw new CsrfError();

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new CsrfError();
  }

  if (originHost !== host) throw new CsrfError();
}
