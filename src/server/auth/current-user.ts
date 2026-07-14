import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "./session";
import {
  assertPermission,
  hasPermission,
  type AuthUser,
} from "@/server/rbac/authz";
import type { PermissionKey } from "@/server/rbac/permissions";

/**
 * Request-scoped current user. `cache` dedupes the DB lookup across a single
 * request (layout + page + actions all share one resolution).
 */
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  return getSessionUser();
});

/**
 * Page/layout guard: require an authenticated user or redirect to login,
 * preserving the intended destination for a safe post-login redirect.
 */
export async function requireUser(nextPath?: string): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    const suffix = nextPath ? `?next=${encodeURIComponent(nextPath)}` : "";
    redirect(`/admin/login${suffix}`);
  }
  return user;
}

/**
 * Page/layout guard: require a specific permission. Redirects unauthenticated
 * users to login and permission-lacking users to the admin "forbidden" page.
 * Authorization is always enforced here on the server — never in the UI alone.
 */
export async function requirePermissionPage(
  permission: PermissionKey,
  nextPath?: string,
): Promise<AuthUser> {
  const user = await requireUser(nextPath);
  if (!hasPermission(user, permission)) redirect("/admin/forbidden");
  return user;
}

/**
 * Server Action / Route Handler guard: require a permission or throw
 * (AuthenticationError / AuthorizationError). Use inside every mutating action
 * so authorization does not depend on the UI hiding a button.
 */
export async function authorize(permission: PermissionKey): Promise<AuthUser> {
  const user = await getCurrentUser();
  assertPermission(user, permission);
  return user;
}
