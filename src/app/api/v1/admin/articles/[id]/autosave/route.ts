import { getActorContext, withApi } from "@/server/api/handler";
import { editorialWorkflowService } from "@/server/services/editorial-workflow.service";
import { ok } from "@/lib/api/response";

export const dynamic = "force-dynamic";

export function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    const [{ id }, body, ctx] = await Promise.all([params, req.json(), getActorContext()]);
    return ok(await editorialWorkflowService.autosave(ctx, id, body));
  });
}
