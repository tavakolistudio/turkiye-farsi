import "server-only";
import { prisma } from "@/lib/db";
import { AUTH } from "./config";

/** Pure predicate — extracted for unit testing. */
export function exceedsLimit(failedCount: number, max: number): boolean {
  return failedCount >= max;
}

/** Record a login attempt (success or failure) for rate limiting + audit. */
export async function recordLoginAttempt(
  email: string,
  ip: string | null,
  success: boolean,
): Promise<void> {
  await prisma.loginAttempt.create({
    data: { email: email.toLowerCase(), ip, success },
  });
}

/**
 * True if there have been too many *failed* attempts for this email+ip within
 * the configured window. Successful logins do not count toward the limit.
 */
export async function isLoginRateLimited(
  email: string,
  ip: string | null,
): Promise<boolean> {
  const since = new Date(Date.now() - AUTH.rateLimit.windowMs);
  const failedCount = await prisma.loginAttempt.count({
    where: {
      email: email.toLowerCase(),
      success: false,
      createdAt: { gte: since },
      ...(ip ? { ip } : {}),
    },
  });
  return exceedsLimit(failedCount, AUTH.rateLimit.maxAttempts);
}

/** Clear failed attempts after a successful login (best-effort). */
export async function clearFailedAttempts(
  email: string,
  ip: string | null,
): Promise<void> {
  await prisma.loginAttempt
    .deleteMany({
      where: { email: email.toLowerCase(), success: false, ...(ip ? { ip } : {}) },
    })
    .catch(() => {});
}
