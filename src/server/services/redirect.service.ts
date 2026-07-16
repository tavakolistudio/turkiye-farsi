import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api/errors";

/**
 * Admin-managed redirects (e.g. after an article/category slug change). Resolves
 * a source path to its final destination, following chains while guarding
 * against loops and unbounded chains. Runs in the Node runtime (called from the
 * not-found path of dynamic pages), never in edge middleware.
 */

const MAX_HOPS = 10;

type RedirectClient = Pick<Prisma.TransactionClient, "redirect">;

export interface ResolvedRedirect {
  to: string;
  permanent: boolean;
}

/** Normalise a path for lookup: ensure a leading slash, drop trailing slash + query/hash. */
export function normalizeRedirectPath(path: string): string {
  let p = (path || "").split("#")[0].split("?")[0].trim();
  if (!p.startsWith("/")) p = `/${p}`;
  if (p.length > 1) p = p.replace(/\/+$/, "");
  return p;
}

/** Store a redirect at its final destination, rejecting self-links and cycles. */
export async function registerRedirect(
  db: RedirectClient,
  from: string,
  to: string,
  permanent = true,
): Promise<void> {
  const source = normalizeRedirectPath(from);
  let destination = normalizeRedirectPath(to);
  const visited = new Set<string>([source]);

  for (let hop = 0; hop < MAX_HOPS; hop++) {
    if (visited.has(destination)) {
      throw ApiError.validation("مسیر تغییرنشانی باعث ایجاد حلقه می‌شود.");
    }
    visited.add(destination);
    const next = await db.redirect.findUnique({ where: { from: destination }, select: { to: true } });
    if (!next) break;
    destination = normalizeRedirectPath(next.to);
    if (hop === MAX_HOPS - 1) {
      throw ApiError.validation("زنجیره تغییرنشانی بیش از حد طولانی است.");
    }
  }

  await db.redirect.upsert({
    where: { from: source },
    create: { from: source, to: destination, permanent },
    update: { to: destination, permanent },
  });
}

export const redirectService = {
  /**
   * Resolve `from` to a final destination. Follows chains (A→B→C) up to
   * MAX_HOPS and stops on any loop. Returns null when there is no redirect.
   * `permanent` is false if any hop in the chain was temporary.
   */
  async resolve(from: string): Promise<ResolvedRedirect | null> {
    const start = normalizeRedirectPath(from);
    const visited = new Set<string>([start]);
    let current = start;
    let permanent = true;
    let found = false;

    for (let hop = 0; hop < MAX_HOPS; hop++) {
      const row = await prisma.redirect.findUnique({
        where: { from: current },
        select: { to: true, permanent: true },
      });
      if (!row) break;
      found = true;
      permanent = permanent && row.permanent;
      const next = normalizeRedirectPath(row.to);

      // Loop guard: a redirect that points back into the visited chain is a
      // cycle — refuse the whole chain (404) rather than emit a redirect that
      // would ping-pong in the browser.
      if (visited.has(next)) {
        return null;
      }
      visited.add(next);
      current = next;

      // If the destination isn't itself a redirect source, we're done.
      const isChained = await prisma.redirect.findUnique({ where: { from: current }, select: { from: true } });
      if (!isChained) break;
    }

    if (!found || current === start) return null;
    return { to: current, permanent };
  },
};
