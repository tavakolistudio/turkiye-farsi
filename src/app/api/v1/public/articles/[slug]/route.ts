import { withApi } from "@/server/api/handler";
import { enforcePublicRateLimit } from "@/server/api/rate-limit";
import { publicContentService } from "@/server/services/public-content.service";
import { ok } from "@/lib/api/response";
import { publicSlugSchema } from "@/lib/validations/public";

export const dynamic = "force-dynamic";

export function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  return withApi(async () => {
    enforcePublicRateLimit(req, "public-article", 120);
    const slug = publicSlugSchema.parse((await params).slug);
    return ok(await publicContentService.getArticleBySlug(slug));
  });
}
