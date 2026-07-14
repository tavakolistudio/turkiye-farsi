import { getActorContext, withApi } from "@/server/api/handler";
import { categoryService } from "@/server/services/category.service";
import { ok } from "@/lib/api/response";

export const dynamic = "force-dynamic";

export function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    const ctx = await getActorContext();
    return ok(await categoryService.restore(ctx, (await params).id));
  });
}
