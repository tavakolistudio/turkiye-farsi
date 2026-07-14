import { getActorContext, withApi } from "@/server/api/handler";
import { tagService } from "@/server/services/tag.service";
import { ok } from "@/lib/api/response";

export const dynamic = "force-dynamic";

export function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    const ctx = await getActorContext();
    return ok(await tagService.restore(ctx, (await params).id));
  });
}
