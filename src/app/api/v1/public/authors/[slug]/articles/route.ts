import { withApi } from "@/server/api/handler";
import { enforcePublicRateLimit } from "@/server/api/rate-limit";
import { publicContentService } from "@/server/services/public-content.service";
import { parseParams, publicListSchema, publicSlugSchema } from "@/lib/validations/public";
import { ok } from "@/lib/api/response";
export const dynamic = "force-dynamic";
export function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) { return withApi(async () => { enforcePublicRateLimit(req, "public-author", 120); const slug = publicSlugSchema.parse((await params).slug); const query = parseParams(publicListSchema, new URL(req.url).searchParams); const result = await publicContentService.articlesByAuthor(slug, query); return ok(result.rows, result.meta); }); }
