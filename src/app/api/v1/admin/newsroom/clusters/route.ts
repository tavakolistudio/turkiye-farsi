import { getActorContext, withApi } from "@/server/api/handler";
import { ok } from "@/lib/api/response";
import { newsroomService } from "@/server/newsroom/newsroom.service";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return withApi(async () => {
    const ctx = await getActorContext();
    const sp = new URL(req.url).searchParams;
    const { rows, ...meta } = await newsroomService.listClusters(ctx, {
      page: sp.get("page") ? Number(sp.get("page")) : 1,
      pageSize: sp.get("pageSize") ? Number(sp.get("pageSize")) : 20,
    });
    return ok(rows, meta);
  });
}
