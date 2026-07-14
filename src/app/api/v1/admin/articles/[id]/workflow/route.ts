import { getActorContext, withApi } from "@/server/api/handler";
import { editorialWorkflowService } from "@/server/services/editorial-workflow.service";
import { ok } from "@/lib/api/response";

export const dynamic = "force-dynamic";

export function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    const [{ id }, ctx] = await Promise.all([params, getActorContext()]);
    return ok(await editorialWorkflowService.timeline(ctx, id));
  });
}

export function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    const [{ id }, body, ctx] = await Promise.all([params, req.json(), getActorContext()]);
    return ok(await editorialWorkflowService.transition(ctx, id, body));
  });
}
