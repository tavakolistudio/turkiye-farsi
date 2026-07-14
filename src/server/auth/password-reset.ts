import "server-only";
import { randomBytes, createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { AUTH } from "./config";
import { hashPassword } from "./password";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Create a single-use reset token for a user. Returns the raw token, which is
 * delivered by email (or logged in dev). Only its hash is stored.
 */
export async function createResetToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt: new Date(Date.now() + AUTH.resetTtlMs),
    },
  });
  return token;
}

/** Return the userId for a valid (unused, unexpired) token, or null. */
export async function validateResetToken(token: string): Promise<string | null> {
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) return null;
  return row.userId;
}

/**
 * Consume a reset token: set the new password, mark the token used, and revoke
 * all existing sessions. Atomic. Returns the userId on success, else null.
 */
export async function consumeResetToken(
  token: string,
  newPassword: string,
): Promise<string | null> {
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) return null;

  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.passwordResetToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: row.userId },
      data: { passwordHash },
    }),
    prisma.session.updateMany({
      where: { userId: row.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
  return row.userId;
}
