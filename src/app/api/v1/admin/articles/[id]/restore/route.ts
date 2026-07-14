import { getActorContext, withApi } from "@/server/api/handler";
import { articleService } from "@/server/services/article.service";
import { ok } from "@/lib/api/response";

export const dynamic = "force-dynamic";

export function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    const ctx = await getActorContext();
    const { id } = await params;
    return ok(await articleService.restore(ctx, id));
  });
}
