import { NextResponse } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { hasPermission } from "@/server/rbac/authz";
import { PERMISSIONS } from "@/server/rbac/permissions";
import { prisma } from "@/lib/db";

/**
 * Admin summary API. Demonstrates that Route Handlers enforce authorization on
 * the server, independent of the UI:
 *   - no session            -> 401
 *   - session without perm  -> 403
 *   - session with perm     -> 200 + stats
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (!hasPermission(user, PERMISSIONS.ANALYTICS_VIEW)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const [articles, published, users, subscribers] = await Promise.all([
    prisma.article.count({ where: { deletedAt: null } }),
    prisma.article.count({ where: { status: "PUBLISHED", deletedAt: null } }),
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.newsletterSubscriber.count(),
  ]);

  return NextResponse.json({ articles, published, users, subscribers });
}
