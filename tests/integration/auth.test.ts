import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import {
  recordLoginAttempt,
  isLoginRateLimited,
  clearFailedAttempts,
  exceedsLimit,
} from "@/server/auth/rate-limit";
import {
  createResetToken,
  validateResetToken,
  consumeResetToken,
} from "@/server/auth/password-reset";
import { revokeAllUserSessions } from "@/server/auth/session";
import { createHash } from "node:crypto";
import { AUTH } from "@/server/auth/config";
import { PERMISSIONS, ROLES } from "@/server/rbac/permissions";

const PREFIX = `itest-${Date.now()}`;
const email = (n: string) => `${PREFIX}-${n}@test.local`;

async function loadPermissionSet(userId: string): Promise<Set<string>> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      roles: {
        include: { role: { include: { permissions: { include: { permission: true } } } } },
      },
    },
  });
  const set = new Set<string>();
  for (const ur of user.roles)
    for (const rp of ur.role.permissions) set.add(rp.permission.key);
  return set;
}

async function createUser(name: string, roleKey?: string) {
  const user = await prisma.user.create({
    data: {
      email: email(name),
      name: `Test ${name}`,
      passwordHash: await hashPassword("OldPass!123"),
    },
  });
  if (roleKey) {
    const role = await prisma.role.findUniqueOrThrow({ where: { key: roleKey } });
    await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  }
  return user;
}

beforeAll(async () => {
  // Ensure roles/permissions exist (seed should have run). Sanity check.
  const permCount = await prisma.permission.count();
  if (permCount === 0) {
    throw new Error("No permissions found — run `npm run db:seed` before tests.");
  }
});

afterAll(async () => {
  // Clean up all test artifacts.
  const users = await prisma.user.findMany({
    where: { email: { startsWith: PREFIX } },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  await prisma.session.deleteMany({ where: { userId: { in: ids } } });
  await prisma.passwordResetToken.deleteMany({ where: { userId: { in: ids } } });
  await prisma.userRole.deleteMany({ where: { userId: { in: ids } } });
  await prisma.loginAttempt.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
});

describe("RBAC effective permissions (from seeded roles)", () => {
  it("Super Admin has every permission", async () => {
    const u = await createUser("super", ROLES.SUPER_ADMIN);
    const perms = await loadPermissionSet(u.id);
    expect(perms.size).toBe(Object.keys(PERMISSIONS).length);
    expect(perms.has(PERMISSIONS.SETTINGS_SENSITIVE)).toBe(true);
  });

  it("Author has create/edit-own but NOT publish", async () => {
    const u = await createUser("author", ROLES.AUTHOR);
    const perms = await loadPermissionSet(u.id);
    expect(perms.has(PERMISSIONS.ARTICLE_CREATE)).toBe(true);
    expect(perms.has(PERMISSIONS.ARTICLE_UPDATE_OWN)).toBe(true);
    expect(perms.has(PERMISSIONS.ARTICLE_PUBLISH)).toBe(false);
  });

  it("Advertising Manager cannot touch the newsroom", async () => {
    const u = await createUser("ads", ROLES.ADVERTISING_MANAGER);
    const perms = await loadPermissionSet(u.id);
    expect(perms.has(PERMISSIONS.AD_MANAGE)).toBe(true);
    expect(perms.has(PERMISSIONS.ARTICLE_CREATE)).toBe(false);
    expect(perms.has(PERMISSIONS.USER_MANAGE)).toBe(false);
  });
});

describe("Login rate limiting", () => {
  it("exceedsLimit is a pure threshold", () => {
    expect(exceedsLimit(4, 5)).toBe(false);
    expect(exceedsLimit(5, 5)).toBe(true);
  });

  it("blocks after max failed attempts and clears on success path", async () => {
    const em = email("rl");
    const ip = "203.0.113.9";
    for (let i = 0; i < AUTH.rateLimit.maxAttempts; i++) {
      await recordLoginAttempt(em, ip, false);
    }
    expect(await isLoginRateLimited(em, ip)).toBe(true);

    await clearFailedAttempts(em, ip);
    expect(await isLoginRateLimited(em, ip)).toBe(false);
  });
});

describe("Password reset lifecycle", () => {
  it("validates, consumes once, updates password, and revokes sessions", async () => {
    const u = await createUser("reset");
    // Give the user an active session that reset should revoke.
    await prisma.session.create({
      data: {
        tokenHash: createHash("sha256").update("dummy").digest("hex"),
        userId: u.id,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    const token = await createResetToken(u.id);
    expect(await validateResetToken(token)).toBe(u.id);

    const consumedFor = await consumeResetToken(token, "BrandNew!456");
    expect(consumedFor).toBe(u.id);

    // Password actually changed.
    const updated = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(await verifyPassword("BrandNew!456", updated.passwordHash!)).toBe(true);
    expect(await verifyPassword("OldPass!123", updated.passwordHash!)).toBe(false);

    // Sessions revoked.
    const active = await prisma.session.count({
      where: { userId: u.id, revokedAt: null },
    });
    expect(active).toBe(0);

    // Token is single-use.
    expect(await consumeResetToken(token, "Another!789")).toBeNull();
    expect(await validateResetToken(token)).toBeNull();
  });
});

describe("Session revocation (sign out everywhere)", () => {
  it("revokes all active sessions for a user", async () => {
    const u = await createUser("revoke");
    for (const t of ["a", "b", "c"]) {
      await prisma.session.create({
        data: {
          tokenHash: createHash("sha256").update(`${u.id}-${t}`).digest("hex"),
          userId: u.id,
          expiresAt: new Date(Date.now() + 60_000),
        },
      });
    }
    const revoked = await revokeAllUserSessions(u.id);
    expect(revoked).toBe(3);
    const active = await prisma.session.count({
      where: { userId: u.id, revokedAt: null },
    });
    expect(active).toBe(0);
  });
});
