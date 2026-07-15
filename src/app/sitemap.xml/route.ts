import { seoFeedService, SITEMAP_CHUNK } from "@/server/services/seo-feed.service";
import { absoluteUrl } from "@/lib/seo/urls";
import { sitemapIndexXml } from "@/lib/seo/sitemap-xml";
import { xmlResponse } from "@/lib/seo/xml";

export const dynamic = "force-dynamic";

/** Sitemap index: one child sitemap per content type + the News sitemap. */
export async function GET() {
  const articleCount = await seoFeedService.countArticles();
  const chunks = Math.max(1, Math.ceil(articleCount / SITEMAP_CHUNK));

  const entries: { loc: string; lastmod?: Date }[] = [
    { loc: absoluteUrl("/sitemaps/pages.xml")! },
    { loc: absoluteUrl("/sitemaps/categories.xml")! },
    { loc: absoluteUrl("/sitemaps/tags.xml")! },
    { loc: absoluteUrl("/sitemaps/authors.xml")! },
  ];
  for (let p = 1; p <= chunks; p++) {
    entries.push({ loc: absoluteUrl(`/sitemaps/articles.xml${p > 1 ? `?p=${p}` : ""}`)! });
  }
  entries.push({ loc: absoluteUrl("/news-sitemap.xml")!, lastmod: new Date() });

  return xmlResponse(sitemapIndexXml(entries), 3600);
}
