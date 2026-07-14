import { fail, ok } from "@/lib/api/response";
import { isValidCronRequest } from "@/server/security/cron";
import { schedulingService } from "@/server/services/scheduling.service";
import { withApi } from "@/server/api/handler";

export const dynamic = "force-dynamic";

export function POST(req: Request) {
  return withApi(async () => {
    if (!isValidCronRequest(req)) return fail("UNAUTHENTICATED", "اعتبار Cron نامعتبر است.", 401);
    return ok(await schedulingService.runDue());
  });
}
