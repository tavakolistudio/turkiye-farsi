import { getActorContext, withApi } from "@/server/api/handler";
import { previewService } from "@/server/services/preview.service";
import { ok } from "@/lib/api/response";

export function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    const [{ id }, body, ctx] = await Promise.all([params, req.json(), getActorContext()]);
    return ok(await previewService.create(ctx, id, body), {}, 201);
  });
}

export function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    const [{ id }, ctx] = await Promise.all([params, getActorContext()]);
    return ok(await previewService.revokeAll(ctx, id));
  });
}
