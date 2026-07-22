import { fail, ok } from "@/lib/api/response";
import { isValidCronRequest } from "@/server/security/cron";
import { withApi } from "@/server/api/handler";
import { runCleanup } from "@/server/newsroom/cleanup.service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Retention cleanup cron. CRON_SECRET-protected (fails closed). Soft-deletes old
 * REJECTED items and archives old job logs; never touches drafts, provenance,
 * articles, revisions or source attribution. Advisory-locked and idempotent.
 */
function handle(req: Request) {
  return withApi(async () => {
    if (!isValidCronRequest(req)) return fail("UNAUTHENTICATED", "اعتبار Cron نامعتبر است.", 401);
    return ok(await runCleanup({ dryRun: false }));
  });
}

export const GET = handle;
export const POST = handle;
