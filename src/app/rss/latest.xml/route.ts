import { renderRssFeed } from "@/lib/seo/rss-feed";
import { xmlResponse } from "@/lib/seo/xml";
import { siteConfig } from "@/lib/site-config";

export const dynamic = "force-dynamic";

export async function GET() {
  const xml = await renderRssFeed({
    titleSuffix: "آخرین اخبار",
    description: `جدیدترین اخبار ${siteConfig.name}`,
    sectionPath: "/latest",
    feedPath: "/rss/latest.xml",
  });
  return xmlResponse(xml, 900);
}
