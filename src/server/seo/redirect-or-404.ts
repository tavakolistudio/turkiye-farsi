import "server-only";
import { redirect, permanentRedirect, notFound } from "next/navigation";
import { redirectService } from "@/server/services/redirect.service";

/**
 * When a dynamic public page can't find its entity, consult the redirect table
 * before 404-ing: an admin may have moved the slug. Issues a 308 (permanent) or
 * 307 (temporary) to the resolved destination, otherwise triggers notFound().
 * Always throws — the return type is `never`.
 */
export async function redirectOrNotFound(fromPath: string): Promise<never> {
  const resolved = await redirectService.resolve(fromPath);
  if (resolved) {
    // Encode non-ASCII (e.g. Persian slugs) so the Location header is valid,
    // without double-encoding already-escaped destinations.
    const target = /%[0-9a-fA-F]{2}/.test(resolved.to) ? resolved.to : encodeURI(resolved.to);
    if (resolved.permanent) permanentRedirect(target);
    redirect(target);
  }
  notFound();
}
