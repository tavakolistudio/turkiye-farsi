import { describe, it, expect } from "vitest";
import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  hasRole,
  assertPermission,
  assertAuthenticated,
  type AuthUser,
} from "@/server/rbac/authz";
import { PERMISSIONS, ROLES } from "@/server/rbac/permissions";
import { AuthenticationError, AuthorizationError } from "@/server/auth/errors";

function makeUser(perms: string[], roles: string[] = []): AuthUser {
  return {
    id: "u1",
    email: "a@b.c",
    name: "T",
    isActive: true,
    roleKeys: roles,
    permissions: new Set(perms),
  };
}

describe("RBAC authorization helpers", () => {
  it("hasPermission checks membership", () => {
    const u = makeUser([PERMISSIONS.ARTICLE_CREATE]);
    expect(hasPermission(u, PERMISSIONS.ARTICLE_CREATE)).toBe(true);
    expect(hasPermission(u, PERMISSIONS.ARTICLE_PUBLISH)).toBe(false);
    expect(hasPermission(null, PERMISSIONS.ARTICLE_CREATE)).toBe(false);
  });

  it("hasAnyPermission / hasAllPermissions", () => {
    const u = makeUser([PERMISSIONS.ARTICLE_CREATE, PERMISSIONS.MEDIA_UPLOAD]);
    expect(hasAnyPermission(u, [PERMISSIONS.ARTICLE_PUBLISH, PERMISSIONS.MEDIA_UPLOAD])).toBe(true);
    expect(hasAllPermissions(u, [PERMISSIONS.ARTICLE_CREATE, PERMISSIONS.MEDIA_UPLOAD])).toBe(true);
    expect(hasAllPermissions(u, [PERMISSIONS.ARTICLE_CREATE, PERMISSIONS.ARTICLE_PUBLISH])).toBe(false);
  });

  it("hasRole checks role membership", () => {
    const u = makeUser([], [ROLES.EDITOR]);
    expect(hasRole(u, ROLES.EDITOR)).toBe(true);
    expect(hasRole(u, ROLES.SUPER_ADMIN)).toBe(false);
  });

  it("assertAuthenticated throws when missing", () => {
    expect(() => assertAuthenticated(null)).toThrow(AuthenticationError);
    expect(() => assertAuthenticated(makeUser([]))).not.toThrow();
  });

  it("assertPermission throws AuthorizationError without the permission", () => {
    const u = makeUser([PERMISSIONS.ARTICLE_CREATE]);
    expect(() => assertPermission(u, PERMISSIONS.ARTICLE_CREATE)).not.toThrow();
    expect(() => assertPermission(u, PERMISSIONS.ARTICLE_PUBLISH)).toThrow(AuthorizationError);
    expect(() => assertPermission(null, PERMISSIONS.ARTICLE_CREATE)).toThrow(AuthenticationError);
  });
});
