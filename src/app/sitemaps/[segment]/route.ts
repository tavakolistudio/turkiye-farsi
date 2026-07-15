import { notFound } from "next/navigation";
import { seoFeedService, SITEMAP_CHUNK, type SitemapEntry } from "@/server/services/seo-feed.service";
import { absoluteUrl } from "@/lib/seo/urls";
import { urlsetXml, type UrlEntry } from "@/lib/seo/sitemap-xml";
import { xmlResponse } from "@/lib/seo/xml";

export const dynamic = "force-dynamic";

const CHANGE: Record<string, UrlEntry["changefreq"]> = {
  articles: "daily",
  categories: "daily",
  tags: "weekly",
  authors: "weekly",
  pages: "monthly",
};
const PRIORITY: Record<string, number> = {
  articles: 0.8,
  categories: 0.6,
  tags: 0.4,
  authors: 0.5,
  pages: 0.3,
};

export async function GET(req: Request, { params }: { params: Promise<{ segment: string }> }) {
  const { segment } = await params;
  const name = segment.replace(/\.xml$/i, "");

  let entries: SitemapEntry[];
  if (name === "articles") {
    const p = Math.max(1, Number(new URL(req.url).searchParams.get("p")) || 1);
    entries = await seoFeedService.articles((p - 1) * SITEMAP_CHUNK, SITEMAP_CHUNK);
  } else if (name === "categories") {
    entries = await seoFeedService.categories();
  } else if (name === "tags") {
    entries = await seoFeedService.tags();
  } else if (name === "authors") {
    entries = await seoFeedService.authors();
  } else if (name === "pages") {
    entries = await seoFeedService.staticPages();
  } else {
    notFound();
  }

  const urls: UrlEntry[] = entries.map((e) => ({
    loc: absoluteUrl(e.path)!,
    lastmod: e.lastModified,
    changefreq: CHANGE[name],
    priority: PRIORITY[name],
  }));
  return xmlResponse(urlsetXml(urls), 3600);
}
