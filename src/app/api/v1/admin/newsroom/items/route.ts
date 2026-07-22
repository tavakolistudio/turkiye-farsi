import { getActorContext, withApi } from "@/server/api/handler";
import { ok } from "@/lib/api/response";
import { newsroomService, type ItemListFilter } from "@/server/newsroom/newsroom.service";

export const dynamic = "force-dynamic";

const BUCKETS = new Set(["URGENT", "HIGH", "REVIEW", "LOW"]);

export function GET(req: Request) {
  return withApi(async () => {
    const ctx = await getActorContext();
    const sp = new URL(req.url).searchParams;
    const bucketRaw = sp.get("bucket")?.toUpperCase();
    const filter: ItemListFilter = {
      bucket: bucketRaw && BUCKETS.has(bucketRaw) ? (bucketRaw as ItemListFilter["bucket"]) : undefined,
      status: sp.get("status") ?? undefined,
      page: sp.get("page") ? Number(sp.get("page")) : 1,
      pageSize: sp.get("pageSize") ? Number(sp.get("pageSize")) : 20,
    };
    const { rows, ...meta } = await newsroomService.listItems(ctx, filter);
    return ok(rows, meta);
  });
}
