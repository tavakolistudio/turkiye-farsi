import { getActorContext, withApi } from "@/server/api/handler";
import { sourceService } from "@/server/services/source.service";
import { ok } from "@/lib/api/response";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export function GET(_req: Request, { params }: Params) {
  return withApi(async () => {
    const ctx = await getActorContext();
    return ok(await sourceService.getById(ctx, (await params).id));
  });
}

export function PATCH(req: Request, { params }: Params) {
  return withApi(async () => {
    const ctx = await getActorContext();
    return ok(await sourceService.update(ctx, (await params).id, await req.json()));
  });
}

export function DELETE(_req: Request, { params }: Params) {
  return withApi(async () => {
    const ctx = await getActorContext();
    return ok(await sourceService.softDelete(ctx, (await params).id));
  });
}
