import { withApi } from "@/server/api/handler";
import { enforcePublicRateLimit } from "@/server/api/rate-limit";
import { publicContentService } from "@/server/services/public-content.service";
import { mostViewedSchema, parseParams } from "@/lib/validations/public";
import { ok } from "@/lib/api/response";
export const dynamic = "force-dynamic";
export function GET(req: Request) { return withApi(async () => { enforcePublicRateLimit(req, "public-most-viewed", 120); const query = parseParams(mostViewedSchema, new URL(req.url).searchParams); const result = await publicContentService.mostViewed(query.range, query); return ok(result.rows, result.meta); }); }
