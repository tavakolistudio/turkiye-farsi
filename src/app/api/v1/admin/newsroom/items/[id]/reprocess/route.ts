import { getActorContext, withApi } from "@/server/api/handler";
import { assertSameOrigin } from "@/server/security/csrf";
import { ok } from "@/lib/api/response";
import { newsroomService } from "@/server/newsroom/newsroom.service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Re-run classification/scoring/trust for an item (newsroom.review). */
export function POST(_req: Request, { params }: Params) {
  return withApi(async () => {
    await assertSameOrigin();
    const ctx = await getActorContext();
    return ok(await newsroomService.reprocessItem(ctx, (await params).id));
  });
}
