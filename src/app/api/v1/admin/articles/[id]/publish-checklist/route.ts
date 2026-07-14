import { getActorContext, withApi } from "@/server/api/handler";
import { publishValidationService } from "@/server/services/publish-validation.service";
import { articleService } from "@/server/services/article.service";
import { ok } from "@/lib/api/response";

export function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    const [{ id }, ctx] = await Promise.all([params, getActorContext()]);
    await articleService.getById(ctx, id);
    return ok(await publishValidationService.forArticle(id));
  });
}
