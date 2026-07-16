import { seoFeedService } from "@/server/services/seo-feed.service";
import { siteConfig } from "@/lib/site-config";
import { absoluteUrl } from "@/lib/seo/urls";
import { buildRss, type RssItem } from "@/lib/seo/rss-xml";
import { routes } from "@/lib/public-links";

/** Turn feed rows into RSS items with absolute, valid URLs only. */
export async function renderRssFeed(opts: {
  titleSuffix?: string;
  description: string;
  sectionPath: string; // e.g. "/", "/breaking", "/category/x"
  feedPath: string; // e.g. "/rss.xml"
  categorySlug?: string;
  breaking?: boolean;
}): Promise<string> {
  const rows = await seoFeedService.rss({ limit: 30, categorySlug: opts.categorySlug, breaking: opts.breaking });
  const items: RssItem[] = rows.map((r) => ({
    title: r.title,
    link: absoluteUrl(routes.article(r.slug))!,
    guid: absoluteUrl(routes.article(r.slug))!,
    description: r.summary,
    pubDate: r.publishedAt,
    author: r.authorName,
    category: r.categoryName,
    image: r.imageUrl ? absoluteUrl(r.imageUrl) : null,
    imageType: r.imageMimeType,
  }));
  return buildRss(
    {
      title: `${siteConfig.name}${opts.titleSuffix ? ` — ${opts.titleSuffix}` : ""}`,
      link: absoluteUrl(opts.sectionPath)!,
      feedUrl: absoluteUrl(opts.feedPath)!,
      description: opts.description,
      language: "fa-IR",
    },
    items,
  );
}
