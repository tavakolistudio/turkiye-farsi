import { getActorContext, withApi } from "@/server/api/handler";
import { assertSameOrigin } from "@/server/security/csrf";
import { ok } from "@/lib/api/response";
import { newsroomService } from "@/server/newsroom/newsroom.service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Create a private DRAFT article from an ingested item (newsroom.create_draft). */
export function POST(_req: Request, { params }: Params) {
  return withApi(async () => {
    await assertSameOrigin();
    const ctx = await getActorContext();
    return ok(await newsroomService.createDraftFromItem(ctx, (await params).id), {}, 201);
  });
}
