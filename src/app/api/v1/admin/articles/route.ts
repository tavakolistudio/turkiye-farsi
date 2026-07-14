import { getActorContext, withApi } from "@/server/api/handler";
import { articleService } from "@/server/services/article.service";
import { parseListQuery } from "@/lib/api/pagination";
import { ok } from "@/lib/api/response";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return withApi(async () => {
    const ctx = await getActorContext();
    const sp = new URL(req.url).searchParams;
    const query = {
      ...parseListQuery(sp),
      status: sp.get("status") ?? undefined,
      authorId: sp.get("authorId") ?? undefined,
      categoryId: sp.get("categoryId") ?? undefined,
    };
    const { rows, meta } = await articleService.list(ctx, query);
    return ok(rows, meta);
  });
}

export function POST(req: Request) {
  return withApi(async () => {
    const ctx = await getActorContext();
    const body = await req.json();
    const created = await articleService.create(ctx, body);
    return ok(created, {}, 201);
  });
}
