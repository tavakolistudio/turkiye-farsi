import "server-only";
import { randomBytes, createHash } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { AUTH } from "./config";
import type { AuthUser } from "@/server/rbac/authz";

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

/** Store only the hash of the token; the raw token lives solely in the cookie. */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires,
  };
}

/** Create a session for a user and set the session cookie. */
export async function createSession(
  userId: string,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<void> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + AUTH.sessionTtlMs);

  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(AUTH.cookieName, token, cookieOptions(expiresAt));
}

/**
 * Resolve the current session into an AuthUser (with effective permissions),
 * or null. Enforces expiry, revocation, active user and non-deleted user.
 * Touches lastUsedAt opportunistically.
 */
export async function getSessionUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH.cookieName)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: {
        include: {
          roles: {
            include: {
              role: { include: { permissions: { include: { permission: true } } } },
            },
          },
        },
      },
    },
  });

  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt.getTime() < Date.now()) return null;

  const user = session.user;
  if (!user.isActive || user.deletedAt) return null;

  const roleKeys = user.roles.map((ur) => ur.role.key);
  const permissions = new Set<string>();
  for (const ur of user.roles) {
    for (const rp of ur.role.permissions) permissions.add(rp.permission.key);
  }

  // Opportunistic lastUsedAt refresh (best-effort, non-blocking failure).
  prisma.session
    .update({ where: { id: session.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    isActive: user.isActive,
    roleKeys,
    permissions,
  };
}

/** Revoke the current session (if any) and clear the cookie. */
export async function destroyCurrentSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH.cookieName)?.value;
  if (token) {
    await prisma.session
      .updateMany({
        where: { tokenHash: hashToken(token), revokedAt: null },
        data: { revokedAt: new Date() },
      })
      .catch(() => {});
  }
  cookieStore.delete(AUTH.cookieName);
}

/** Revoke every active session for a user (sign-out-everywhere / deactivation). */
export async function revokeAllUserSessions(userId: string): Promise<number> {
  const res = await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return res.count;
}
