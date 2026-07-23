import { getActorContext, withApi } from "@/server/api/handler";
import { assertSameOrigin } from "@/server/security/csrf";
import { ok } from "@/lib/api/response";
import { newsroomService } from "@/server/newsroom/newsroom.service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Reject an ingested item (newsroom.reject). */
export function POST(req: Request, { params }: Params) {
  return withApi(async () => {
    await assertSameOrigin();
    const ctx = await getActorContext();
    const body = (await req.json().catch(() => ({}))) as { reason?: string };
    return ok(await newsroomService.reject(ctx, (await params).id, body.reason));
  });
}
