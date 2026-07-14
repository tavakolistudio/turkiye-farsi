import { AuthenticationError, AuthorizationError } from "@/server/auth/errors";
import type { PermissionKey, RoleKey } from "./permissions";

/**
 * The authenticated principal, with its effective permissions pre-computed.
 * `permissions` is the union of all permissions granted by the user's roles.
 * These are pure functions so they can be unit-tested without a database.
 */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  roleKeys: string[];
  permissions: Set<string>;
}

export function hasPermission(
  user: Pick<AuthUser, "permissions"> | null | undefined,
  permission: PermissionKey,
): boolean {
  return !!user && user.permissions.has(permission);
}

export function hasAnyPermission(
  user: Pick<AuthUser, "permissions"> | null | undefined,
  permissions: PermissionKey[],
): boolean {
  return !!user && permissions.some((p) => user.permissions.has(p));
}

export function hasAllPermissions(
  user: Pick<AuthUser, "permissions"> | null | undefined,
  permissions: PermissionKey[],
): boolean {
  return !!user && permissions.every((p) => user.permissions.has(p));
}

export function hasRole(
  user: Pick<AuthUser, "roleKeys"> | null | undefined,
  role: RoleKey,
): boolean {
  return !!user && user.roleKeys.includes(role);
}

/** Assert authentication; throws AuthenticationError if missing. */
export function assertAuthenticated<T extends AuthUser>(
  user: T | null | undefined,
): asserts user is T {
  if (!user) throw new AuthenticationError();
}

/** Assert a permission; throws Authentication/Authorization errors. */
export function assertPermission(
  user: AuthUser | null | undefined,
  permission: PermissionKey,
): asserts user is AuthUser {
  assertAuthenticated(user);
  if (!hasPermission(user, permission)) throw new AuthorizationError();
}

/** Assert at least one of the given permissions. */
export function assertAnyPermission(
  user: AuthUser | null | undefined,
  permissions: PermissionKey[],
): asserts user is AuthUser {
  assertAuthenticated(user);
  if (!hasAnyPermission(user, permissions)) throw new AuthorizationError();
}
