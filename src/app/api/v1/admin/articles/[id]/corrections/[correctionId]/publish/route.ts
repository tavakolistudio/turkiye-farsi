import { getActorContext, withApi } from "@/server/api/handler";
import { correctionService } from "@/server/services/correction.service";
import { ok } from "@/lib/api/response";

export function POST(_req: Request, { params }: { params: Promise<{ id: string; correctionId: string }> }) {
  return withApi(async () => {
    const [{ id, correctionId }, ctx] = await Promise.all([params, getActorContext()]);
    return ok(await correctionService.publish(ctx, id, correctionId));
  });
}
