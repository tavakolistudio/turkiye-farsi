import type { AuthUser } from "@/server/rbac/authz";

/**
 * The context every service call runs in: who is acting, plus request metadata
 * for the audit trail. The API/action layer builds this (with request IP/UA);
 * tests can build it with just an actor. Keeping services free of `next/headers`
 * makes them unit-testable.
 */
export interface ServiceContext {
  actor: AuthUser;
  ip?: string | null;
  userAgent?: string | null;
}
