import { fail, ok } from "@/lib/api/response";
import { isValidCronRequest } from "@/server/security/cron";
import { withApi } from "@/server/api/handler";
import { newsroomPipeline } from "@/server/newsroom/pipeline.service";

export const dynamic = "force-dynamic";
// Keep well under the Vercel Hobby execution limit; the pipeline itself caps the
// number of sources/items per run via NewsroomSettings.
export const maxDuration = 60;

/**
 * Newsroom collection. Authenticated by CRON_SECRET (Bearer), never a
 * query string; fails closed when the secret is unset. The pipeline enforces a
 * batch lock (no concurrent runs), honours every kill switch, and is idempotent
 * (unique sourceId+externalId), so re-invocation is safe. Never publishes.
 *
 * Not on Vercel's automatic schedule (see vercel.json) — the Hobby plan's cron
 * count limit meant collection + cleanup were combined into a single daily
 * `/api/cron/newsroom-dispatch` job. This route is kept, still CRON_SECRET
 * -protected, for manual/ops triggering.
 */
function handle(req: Request) {
  return withApi(async () => {
    if (!isValidCronRequest(req)) return fail("UNAUTHENTICATED", "اعتبار Cron نامعتبر است.", 401);
    return ok(await newsroomPipeline.runCollection({ trigger: "cron" }));
  });
}

export const GET = handle;
export const POST = handle;
