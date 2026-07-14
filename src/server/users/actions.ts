"use server";

import { prisma } from "@/lib/db";
import { authorize } from "@/server/auth/current-user";
import { revokeAllUserSessions } from "@/server/auth/session";
import { getRequestMeta } from "@/server/auth/request-meta";
import { auditLog } from "@/server/audit/log";
import { assertSameOrigin } from "@/server/security/csrf";
import { PERMISSIONS } from "@/server/rbac/permissions";

export interface UserActionResult {
  ok: boolean;
  error?: string;
  revokedSessions?: number;
}

/** Deactivate a user and revoke all their sessions. Requires USER_MANAGE. */
export async function deactivateUserAction(userId: string): Promise<UserActionResult> {
  await assertSameOrigin();
  const actor = await authorize(PERMISSIONS.USER_MANAGE);
  if (actor.id === userId) {
    return { ok: false, error: "نمی‌توانید حساب خودتان را غیرفعال کنید." };
  }

  await prisma.user.update({ where: { id: userId }, data: { isActive: false } });
  const revoked = await revokeAllUserSessions(userId);

  const { ip, userAgent } = await getRequestMeta();
  await auditLog({
    userId: actor.id,
    action: "user.deactivate",
    entityType: "user",
    entityId: userId,
    ip,
    userAgent,
    after: { isActive: false, revokedSessions: revoked },
  });
  return { ok: true, revokedSessions: revoked };
}

/** Reactivate a user. Requires USER_MANAGE. */
export async function activateUserAction(userId: string): Promise<UserActionResult> {
  await assertSameOrigin();
  const actor = await authorize(PERMISSIONS.USER_MANAGE);
  await prisma.user.update({ where: { id: userId }, data: { isActive: true } });

  const { ip, userAgent } = await getRequestMeta();
  await auditLog({
    userId: actor.id,
    action: "user.activate",
    entityType: "user",
    entityId: userId,
    ip,
    userAgent,
    after: { isActive: true },
  });
  return { ok: true };
}

/** Revoke all sessions for a user ("sign out everywhere"). Requires USER_MANAGE. */
export async function revokeUserSessionsAction(userId: string): Promise<UserActionResult> {
  await assertSameOrigin();
  const actor = await authorize(PERMISSIONS.USER_MANAGE);
  const revoked = await revokeAllUserSessions(userId);

  const { ip, userAgent } = await getRequestMeta();
  await auditLog({
    userId: actor.id,
    action: "user.sessions.revoked",
    entityType: "user",
    entityId: userId,
    ip,
    userAgent,
    after: { revokedSessions: revoked },
  });
  return { ok: true, revokedSessions: revoked };
}
