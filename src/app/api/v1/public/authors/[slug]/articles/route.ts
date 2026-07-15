import { withApi } from "@/server/api/handler";
import { enforcePublicRateLimit } from "@/server/api/rate-limit";
import { publicSiteService } from "@/server/services/public-site.service";
import { parseListQuery, paginationArgs, paginationMeta } from "@/lib/api/pagination";
import { ok } from "@/lib/api/response";

export const dynamic = "force-dynamic";

export function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  return withApi(async () => {
    enforcePublicRateLimit(req, "public-author", 120);
    const { slug } = await params;
    const query = parseListQuery(new URL(req.url).searchParams);
    const { skip, take } = paginationArgs(query);
    const { profile, rows, total } = await publicSiteService.author(decodeURIComponent(slug), skip, take);
    return ok({ profile, articles: rows }, paginationMeta(query, total));
  });
}
