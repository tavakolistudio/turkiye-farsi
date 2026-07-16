import { fail, ok } from "@/lib/api/response";
import { isValidCronRequest } from "@/server/security/cron";
import { schedulingService } from "@/server/services/scheduling.service";
import { withApi } from "@/server/api/handler";

export const dynamic = "force-dynamic";

/**
 * Scheduled-publish runner. Authenticated by CRON_SECRET (Bearer), never by a
 * query string. Fails closed when the secret is unset. `schedulingService.runDue`
 * is idempotent (atomic claim of SCHEDULED rows), so re-runs never double-publish.
 *
 * Vercel Cron invokes the path with GET; POST is kept for manual/machine triggers.
 * Both require the same secret.
 */
function handle(req: Request) {
  return withApi(async () => {
    if (!isValidCronRequest(req)) return fail("UNAUTHENTICATED", "اعتبار Cron نامعتبر است.", 401);
    return ok(await schedulingService.runDue());
  });
}

export const GET = handle;
export const POST = handle;
