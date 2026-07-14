import { withApi } from "@/server/api/handler";
import { enforcePublicRateLimit } from "@/server/api/rate-limit";
import { publicContentService } from "@/server/services/public-content.service";
import { parseListQuery } from "@/lib/api/pagination";
import { ok } from "@/lib/api/response";

export const dynamic = "force-dynamic";

export function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  return withApi(async () => {
    enforcePublicRateLimit(req, "public-tag-articles", 120);
    const { slug } = await params;
    const query = parseListQuery(new URL(req.url).searchParams);
    const { rows, meta } = await publicContentService.articlesByTag(slug, query);
    return ok(rows, meta);
  });
}
