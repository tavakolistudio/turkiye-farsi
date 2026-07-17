import { withApi } from "@/server/api/handler";
import { enforcePublicRateLimit } from "@/server/api/rate-limit";
import { searchService, searchQuerySchema } from "@/server/services/search.service";
import { ok } from "@/lib/api/response";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return withApi(async () => {
    enforcePublicRateLimit(req, "public-search", 60);
    const sp = new URL(req.url).searchParams;
    const input = searchQuerySchema.parse(Object.fromEntries(sp.entries()));
    const result = await searchService.search(input);
    const response = ok(result.rows, {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: result.totalPages,
    });
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    return response;
  });
}
