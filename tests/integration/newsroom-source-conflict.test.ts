import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// No detector sets TrustContext.conflicting yet (see trust.service.ts), so the
// only way to prove the NEWSROOM_SOURCE_CONFLICT notification path itself
// works is to force evaluateTrust's result. This isolates the mock in its own
// file so it never affects the real trust computation used elsewhere.
vi.mock("@/server/newsroom/scoring/trust.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/newsroom/scoring/trust.service")>();
  return {
    ...actual,
    evaluateTrust: vi.fn(() => ({
      trustScore: 20,
      verificationStatus: "CONFLICTING" as const,
      officialSourceCount: 0,
      independentSourceCount: 2,
      socialOnly: false,
      conflictingClaims: true,
      primarySourceAvailable: false,
      requiresHumanFactCheck: true,
      reasonCodes: ["ادعاهای متناقض میان منابع"],
    })),
  };
});

import { prisma } from "@/lib/db";
import { PERMISSIONS } from "@/server/rbac/permissions";
import { ROLES } from "@/server/rbac/permissions";
import type { AuthUser } from "@/server/rbac/authz";
import type { ServiceContext } from "@/server/services/context";
import { newsroomService } from "@/server/newsroom/newsroom.service";

const PREFIX = `nrconf-${Date.now()}`;
let userId = "";
let sourceId = "";
let itemId = "";
let ctx: ServiceContext;

function actor(id: string, perms: string[]): AuthUser {
  return { id, email: `${id}@test.local`, name: "NR Conflict Test", isActive: true, roleKeys: [], permissions: new Set(perms) };
}

beforeAll(async () => {
  const user = await prisma.user.create({ data: { email: `${PREFIX}@test.local`, name: "NR Conflict", passwordHash: "x" } });
  userId = user.id;
  ctx = { actor: actor(user.id, Object.values(PERMISSIONS)), ip: null, userAgent: "vitest" };

  const source = await prisma.source.create({
    data: { name: `${PREFIX} منبع`, slug: `${PREFIX}-src`, isEnabled: true, collectionMethod: "RSS", trustLevel: 60 },
  });
  sourceId = source.id;
  const item = await prisma.ingestedNewsItem.create({
    data: {
      sourceId, externalId: `${PREFIX}-1`, sourceUrl: "https://example.com/conflict",
      title: `${PREFIX} خبری با ادعاهای متناقض`, ingestionStatus: "SCORED", finalScore: 60, scoreBucket: "REVIEW",
    },
  });
  itemId = item.id;
});

afterAll(async () => {
  await prisma.notification.deleteMany({ where: { type: "NEWSROOM_SOURCE_CONFLICT", userId: { in: await superAdminIds() } } });
  await prisma.ingestedNewsItem.deleteMany({ where: { sourceId } });
  await prisma.source.deleteMany({ where: { id: sourceId } });
  await prisma.user.deleteMany({ where: { id: userId } });
});

async function superAdminIds(): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: { roles: { some: { role: { key: ROLES.SUPER_ADMIN } } } },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

describe("NEWSROOM_SOURCE_CONFLICT notification", () => {
  it("fires a real, idempotent-per-call notification when trust evaluation reports CONFLICTING", async () => {
    const admins = await superAdminIds();
    const before = await prisma.notification.count({ where: { type: "NEWSROOM_SOURCE_CONFLICT", userId: { in: admins } } });

    await newsroomService.reprocessItem(ctx, itemId);

    const after = await prisma.notification.count({ where: { type: "NEWSROOM_SOURCE_CONFLICT", userId: { in: admins } } });
    expect(after).toBe(before + admins.length);

    const refreshed = await prisma.ingestedNewsItem.findUniqueOrThrow({ where: { id: itemId } });
    expect(refreshed.verificationStatus).toBe("CONFLICTING");
  });
});
