import { withApi } from "@/server/api/handler";
import { enforcePublicRateLimit } from "@/server/api/rate-limit";
import { publicContentService } from "@/server/services/public-content.service";
import { parseParams, searchSchema } from "@/lib/validations/public";
import { ok } from "@/lib/api/response";
export const dynamic = "force-dynamic";
export function GET(req: Request) { return withApi(async () => { enforcePublicRateLimit(req, "public-search", 30); const query = parseParams(searchSchema, new URL(req.url).searchParams); const result = await publicContentService.search(query); return ok(result.rows, result.meta); }); }
