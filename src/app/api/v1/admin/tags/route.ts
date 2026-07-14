import { getActorContext, withApi } from "@/server/api/handler";
import { tagService } from "@/server/services/tag.service";
import { parseListQuery } from "@/lib/api/pagination";
import { ok } from "@/lib/api/response";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return withApi(async () => {
    const ctx = await getActorContext();
    const query = parseListQuery(new URL(req.url).searchParams);
    const { rows, meta } = await tagService.list(ctx, query);
    return ok(rows, meta);
  });
}

export function POST(req: Request) {
  return withApi(async () => {
    const ctx = await getActorContext();
    return ok(await tagService.create(ctx, await req.json()), {}, 201);
  });
}
