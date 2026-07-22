import { getActorContext, withApi } from "@/server/api/handler";
import { assertSameOrigin } from "@/server/security/csrf";
import { ok } from "@/lib/api/response";
import { newsroomService } from "@/server/newsroom/newsroom.service";

export const dynamic = "force-dynamic";

export function GET() {
  return withApi(async () => {
    const ctx = await getActorContext();
    return ok(await newsroomService.getSettings(ctx));
  });
}

export function PATCH(req: Request) {
  return withApi(async () => {
    await assertSameOrigin();
    const ctx = await getActorContext();
    return ok(await newsroomService.updateSettings(ctx, await req.json()));
  });
}
