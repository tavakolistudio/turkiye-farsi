import "server-only";
import { getCurrentUser } from "@/server/auth/current-user";
import { getRequestMeta } from "@/server/auth/request-meta";
import { ApiError } from "@/lib/api/errors";
import type { ServiceContext } from "./context";

/** Build a ServiceContext from the current session (for pages & Server Actions). */
export async function getServiceContext(): Promise<ServiceContext> {
  const actor = await getCurrentUser();
  if (!actor) throw ApiError.unauthenticated();
  const { ip, userAgent } = await getRequestMeta();
  return { actor, ip, userAgent };
}
