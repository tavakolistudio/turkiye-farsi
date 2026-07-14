import { z } from "zod";
import { getActorContext, withApi } from "@/server/api/handler";
import { editorialWorkflowService } from "@/server/services/editorial-workflow.service";
import { ok } from "@/lib/api/response";

const schema = z.object({ isResolved: z.boolean() });

export function PATCH(req: Request, { params }: { params: Promise<{ id: string; commentId: string }> }) {
  return withApi(async () => {
    const [{ id, commentId }, body, ctx] = await Promise.all([params, req.json(), getActorContext()]);
    const { isResolved } = schema.parse(body);
    return ok(await editorialWorkflowService.resolveComment(ctx, id, commentId, isResolved));
  });
}
