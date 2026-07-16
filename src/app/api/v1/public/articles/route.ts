import { withApi } from "@/server/api/handler";
import { enforcePublicRateLimit } from "@/server/api/rate-limit";
import { publicContentService } from "@/server/services/public-content.service";
import { newsListSchema, parseParams } from "@/lib/validations/public";
import { ok } from "@/lib/api/response";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return withApi(async () => {
    enforcePublicRateLimit(req, "public-articles", 120);
    const query = parseParams(newsListSchema, new URL(req.url).searchParams);
    const { rows, meta } = await publicContentService.listArticles(query);
    return ok(rows, meta);
  });
}
