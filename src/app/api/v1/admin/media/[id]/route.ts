import { getActorContext, withApi } from "@/server/api/handler";
import { mediaService } from "@/server/services/media.service";
import { ok } from "@/lib/api/response";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export function GET(_req: Request, { params }: Params) {
  return withApi(async () => {
    const ctx = await getActorContext();
    return ok(await mediaService.getById(ctx, (await params).id));
  });
}

export function PATCH(req: Request, { params }: Params) {
  return withApi(async () => {
    const ctx = await getActorContext();
    return ok(await mediaService.updateMeta(ctx, (await params).id, await req.json()));
  });
}

export function DELETE(_req: Request, { params }: Params) {
  return withApi(async () => {
    const ctx = await getActorContext();
    return ok(await mediaService.softDelete(ctx, (await params).id));
  });
}
