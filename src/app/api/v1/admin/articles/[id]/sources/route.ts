import { getActorContext, withApi } from "@/server/api/handler";
import { articleLinksService } from "@/server/services/article-links.service";
import { ok } from "@/lib/api/response";

export function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    const [{ id }, body, ctx] = await Promise.all([params, req.json(), getActorContext()]);
    return ok(await articleLinksService.attachSource(ctx, id, body), {}, 201);
  });
}
