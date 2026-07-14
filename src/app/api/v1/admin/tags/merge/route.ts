import { getActorContext, withApi } from "@/server/api/handler";
import { tagService } from "@/server/services/tag.service";
import { mergeTagSchema } from "@/lib/validations/tag";
import { ok } from "@/lib/api/response";

export const dynamic = "force-dynamic";

export function POST(req: Request) {
  return withApi(async () => {
    const ctx = await getActorContext();
    const { sourceTagId, targetTagId } = mergeTagSchema.parse(await req.json());
    return ok(await tagService.merge(ctx, sourceTagId, targetTagId));
  });
}
