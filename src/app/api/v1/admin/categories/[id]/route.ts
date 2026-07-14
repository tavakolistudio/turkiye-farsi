import { getActorContext, withApi } from "@/server/api/handler";
import { categoryService } from "@/server/services/category.service";
import { ok } from "@/lib/api/response";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export function GET(_req: Request, { params }: Params) {
  return withApi(async () => {
    const ctx = await getActorContext();
    return ok(await categoryService.getById(ctx, (await params).id));
  });
}

export function PATCH(req: Request, { params }: Params) {
  return withApi(async () => {
    const ctx = await getActorContext();
    return ok(await categoryService.update(ctx, (await params).id, await req.json()));
  });
}

export function DELETE(req: Request, { params }: Params) {
  return withApi(async () => {
    const ctx = await getActorContext();
    const reassignTo = new URL(req.url).searchParams.get("reassignTo") ?? undefined;
    return ok(await categoryService.softDelete(ctx, (await params).id, reassignTo));
  });
}
