import { getActorContext, withApi } from "@/server/api/handler";
import { correctionService } from "@/server/services/correction.service";
import { ok } from "@/lib/api/response";

export function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    const [{ id }, ctx] = await Promise.all([params, getActorContext()]);
    return ok(await correctionService.list(ctx, id));
  });
}

export function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    const [{ id }, body, ctx] = await Promise.all([params, req.json(), getActorContext()]);
    return ok(await correctionService.create(ctx, id, body), {}, 201);
  });
}
