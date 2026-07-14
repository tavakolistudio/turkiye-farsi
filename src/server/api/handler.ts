import "server-only";
import { getSessionUser } from "@/server/auth/session";
import { getRequestMeta } from "@/server/auth/request-meta";
import { ApiError } from "@/lib/api/errors";
import { failFrom } from "@/lib/api/response";
import type { ServiceContext } from "@/server/services/context";

/**
 * Resolve the acting user into a ServiceContext for admin API routes.
 * Throws ApiError.unauthenticated when there is no valid session — the route
 * still enforces the specific permission inside the service.
 */
export async function getActorContext(): Promise<ServiceContext> {
  const actor = await getSessionUser();
  if (!actor) throw ApiError.unauthenticated();
  const { ip, userAgent } = await getRequestMeta();
  return { actor, ip, userAgent };
}

/** Wrap a route handler so any thrown error becomes the standard failure envelope. */
export async function withApi(handler: () => Promise<Response>): Promise<Response> {
  try {
    return await handler();
  } catch (err) {
    return failFrom(err);
  }
}
