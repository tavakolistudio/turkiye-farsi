import { getActorContext, withApi } from "@/server/api/handler";
import { assertSameOrigin } from "@/server/security/csrf";
import { ok } from "@/lib/api/response";
import { newsroomService } from "@/server/newsroom/newsroom.service";

export const dynamic = "force-dynamic";

export function POST() {
  return withApi(async () => {
    await assertSameOrigin();
    const ctx = await getActorContext();
    return ok(await newsroomService.resetSettings(ctx));
  });
}
