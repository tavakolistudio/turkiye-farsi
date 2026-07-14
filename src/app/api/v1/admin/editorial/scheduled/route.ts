import { getActorContext, withApi } from "@/server/api/handler";
import { editorialWorkflowService } from "@/server/services/editorial-workflow.service";
import { ok } from "@/lib/api/response";

export function GET() {
  return withApi(async () => ok(await editorialWorkflowService.scheduledArticles(await getActorContext())));
}
