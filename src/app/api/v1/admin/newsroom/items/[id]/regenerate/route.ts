import { getActorContext, withApi } from "@/server/api/handler";
import { assertSameOrigin } from "@/server/security/csrf";
import { ok } from "@/lib/api/response";
import { newsroomService } from "@/server/newsroom/newsroom.service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Regenerate the draft for an item's article (newsroom.regenerate). */
export function POST(req: Request, { params }: Params) {
  return withApi(async () => {
    await assertSameOrigin();
    const ctx = await getActorContext();
    const body = (await req.json().catch(() => ({}))) as { force?: boolean };
    return ok(await newsroomService.regenerateDraft(ctx, (await params).id, { force: !!body.force }));
  });
}
