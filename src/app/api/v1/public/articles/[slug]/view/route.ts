import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { withApi } from "@/server/api/handler";
import { enforcePublicRateLimit } from "@/server/api/rate-limit";
import { publicContentService } from "@/server/services/public-content.service";
import { publicSlugSchema } from "@/lib/validations/public";
import { ok } from "@/lib/api/response";
export const dynamic = "force-dynamic";
const COOKIE = "tf_public_session";
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const response = await withApi(async () => {
    enforcePublicRateLimit(req, "public-view", 60);
    const articleId = publicSlugSchema.parse((await params).slug);
    const cookieHeader = req.headers.get("cookie") ?? "";
    const existing = cookieHeader.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
    const sessionKey = existing && /^[a-f0-9-]{20,80}$/i.test(existing) ? existing : randomUUID();
    const result = await publicContentService.recordView({ articleId, sessionKey, path: new URL(req.url).pathname.replace(/\/api\/v1\/public\/articles\/[^/]+\/view$/, `/news/${articleId}`), referrer: req.headers.get("referer"), userAgent: req.headers.get("user-agent") });
    const output = ok(result) as NextResponse;
    if (!existing) output.cookies.set(COOKIE, sessionKey, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 30, path: "/" });
    return output;
  });
  return response;
}
