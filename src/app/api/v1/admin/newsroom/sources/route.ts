import { getActorContext, withApi } from "@/server/api/handler";
import { ok } from "@/lib/api/response";
import { newsroomService } from "@/server/newsroom/newsroom.service";

export const dynamic = "force-dynamic";

export function GET() {
  return withApi(async () => {
    const ctx = await getActorContext();
    return ok(await newsroomService.listCollectionSources(ctx));
  });
}
