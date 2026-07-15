import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { withApi } from "@/server/api/handler";
import { enforcePublicRateLimit } from "@/server/api/rate-limit";
import { viewService } from "@/server/services/view.service";

export const dynamic = "force-dynamic";

const VIEW_COOKIE = "tf_vk";

/**
 * Record a view for a published article. Idempotent-ish: the server
 * de-duplicates by a rotating, non-identifying session key stored in an
 * httpOnly cookie, filters bots, and only counts genuinely-published articles.
 * Always returns 200 so client tracking can never surface an error.
 */
export function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  return withApi(async () => {
    enforcePublicRateLimit(req, "public-view", 240);
    const { slug } = await params;

    // Read or mint the session key from the request cookies.
    const cookieHeader = req.headers.get("cookie") ?? "";
    const existing = cookieHeader
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${VIEW_COOKIE}=`))
      ?.slice(VIEW_COOKIE.length + 1);
    const sessionKey = existing || randomUUID();

    let path = `/news/${slug}`;
    try {
      const body = (await req.json()) as { path?: unknown };
      if (typeof body?.path === "string" && body.path.startsWith("/")) path = body.path;
    } catch {
      /* body optional */
    }

    const result = await viewService.recordView({
      slug: decodeURIComponent(slug),
      sessionKey,
      userAgent: req.headers.get("user-agent"),
      referrer: req.headers.get("referer"),
      path,
    });

    const res = NextResponse.json({ success: true, data: result, error: null, meta: {} });
    if (!existing) {
      res.cookies.set(VIEW_COOKIE, sessionKey, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 180,
        path: "/",
      });
    }
    return res;
  });
}
