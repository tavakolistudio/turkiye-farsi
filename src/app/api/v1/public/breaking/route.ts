import { withApi } from "@/server/api/handler";
import { enforcePublicRateLimit } from "@/server/api/rate-limit";
import { publicContentService } from "@/server/services/public-content.service";
import { parseParams, publicListSchema } from "@/lib/validations/public";
import { ok } from "@/lib/api/response";
export const dynamic = "force-dynamic";
export function GET(req: Request) { return withApi(async () => { enforcePublicRateLimit(req, "public-breaking", 120); const query = parseParams(publicListSchema, new URL(req.url).searchParams); const result = await publicContentService.listBreaking(query); return ok(result.rows, result.meta); }); }
