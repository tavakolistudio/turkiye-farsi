import { getActorContext, withApi } from "@/server/api/handler";
import { articleService } from "@/server/services/article.service";
import { ok } from "@/lib/api/response";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export function GET(_req: Request, { params }: Params) {
  return withApi(async () => {
    const ctx = await getActorContext();
    const { id } = await params;
    return ok(await articleService.getById(ctx, id));
  });
}

export function PATCH(req: Request, { params }: Params) {
  return withApi(async () => {
    const ctx = await getActorContext();
    const { id } = await params;
    const body = await req.json();
    return ok(await articleService.update(ctx, id, body));
  });
}

export function DELETE(_req: Request, { params }: Params) {
  return withApi(async () => {
    const ctx = await getActorContext();
    const { id } = await params;
    return ok(await articleService.softDelete(ctx, id));
  });
}
