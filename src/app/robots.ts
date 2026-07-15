import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/seo/urls";

/**
 * Dynamic robots.txt. Production is crawlable (public content) while admin,
 * internal APIs, previews and auth flows are disallowed. Non-production and
 * preview deployments are fully disallowed so staging never gets indexed.
 */
function allowIndexing(): boolean {
  // On Vercel, only the production environment should be indexable.
  if (process.env.VERCEL_ENV) return process.env.VERCEL_ENV === "production";
  // Elsewhere: require production build on a real (non-localhost) origin.
  const origin = siteOrigin();
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/i.test(origin);
  return process.env.NODE_ENV === "production" && !isLocal;
}

export default function robots(): MetadataRoute.Robots {
  const origin = siteOrigin();

  if (!allowIndexing()) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/admin/",
          "/api/",
          "/preview",
          "/preview/",
          "/*?*utm_",
        ],
      },
    ],
    sitemap: [`${origin}/sitemap.xml`, `${origin}/news-sitemap.xml`],
    host: origin,
  };
}
