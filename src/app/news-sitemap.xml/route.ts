import { seoFeedService } from "@/server/services/seo-feed.service";
import { siteSettingsService } from "@/server/services/site-settings.service";
import { siteConfig } from "@/lib/site-config";
import { absoluteUrl } from "@/lib/seo/urls";
import { newsSitemapXml } from "@/lib/seo/sitemap-xml";
import { xmlResponse } from "@/lib/seo/xml";
import { routes } from "@/lib/public-links";

export const dynamic = "force-dynamic";

/** Google News sitemap — published articles from the last 48h only. */
export async function GET() {
  const [items, publisher] = await Promise.all([
    seoFeedService.recentNews(1000),
    siteSettingsService.publisher(),
  ]);
  const pubName = publisher.siteName || siteConfig.name;
  const xml = newsSitemapXml(
    items.map((i) => ({ loc: absoluteUrl(routes.article(i.slug))!, title: i.title, publishedAt: i.publishedAt })),
    pubName,
    "fa",
  );
  // Fresh window — cache briefly so new articles surface quickly.
  return xmlResponse(xml, 600);
}
