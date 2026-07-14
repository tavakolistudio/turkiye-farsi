import { getActorContext, withApi } from "@/server/api/handler";
import { correctionService } from "@/server/services/correction.service";
import { ok } from "@/lib/api/response";

export function PATCH(req: Request, { params }: { params: Promise<{ id: string; correctionId: string }> }) {
  return withApi(async () => {
    const [{ id, correctionId }, body, ctx] = await Promise.all([params, req.json(), getActorContext()]);
    return ok(await correctionService.update(ctx, id, correctionId, body));
  });
}
