import { fail, ok } from "@/lib/api/response";
import { isValidCronRequest } from "@/server/security/cron";
import { withApi } from "@/server/api/handler";
import { newsroomPipeline } from "@/server/newsroom/pipeline.service";
import { runCleanup } from "@/server/newsroom/cleanup.service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Combined daily newsroom cron: collection, then retention cleanup, in that
 * fixed order. Exists because the Vercel Hobby plan caps the number of
 * scheduled Cron Jobs — this and `/api/cron/publish` are the only two
 * registered in vercel.json. Each stage already carries its own concurrency
 * guard (collection: the NewsFetchBatch RUNNING lock; cleanup: a Postgres
 * advisory lock), so running them back-to-back here never double-processes or
 * overlaps with a stage triggered independently (e.g. a manual admin run).
 * The individual `/api/cron/newsroom-collect` and `/api/cron/newsroom-cleanup`
 * routes still exist and are still CRON_SECRET-protected, just no longer on
 * Vercel's automatic schedule — kept for manual/ops use.
 */
function handle(req: Request) {
  return withApi(async () => {
    if (!isValidCronRequest(req)) return fail("UNAUTHENTICATED", "اعتبار Cron نامعتبر است.", 401);
    const collection = await newsroomPipeline.runCollection({ trigger: "cron" });
    const cleanup = await runCleanup({ dryRun: false });
    return ok({ collection, cleanup });
  });
}

export const GET = handle;
export const POST = handle;
