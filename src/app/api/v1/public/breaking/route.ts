import { withApi } from "@/server/api/handler";
import { enforcePublicRateLimit } from "@/server/api/rate-limit";
import { publicSiteService } from "@/server/services/public-site.service";
import { parseListQuery, paginationArgs, paginationMeta } from "@/lib/api/pagination";
import { ok } from "@/lib/api/response";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return withApi(async () => {
    enforcePublicRateLimit(req, "public-breaking", 120);
    const query = parseListQuery(new URL(req.url).searchParams);
    const { skip, take } = paginationArgs(query);
    const { rows, total } = await publicSiteService.breaking(skip, take);
    return ok(rows, paginationMeta(query, total));
  });
}
