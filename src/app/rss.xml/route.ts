import { renderRssFeed } from "@/lib/seo/rss-feed";
import { xmlResponse } from "@/lib/seo/xml";
import { siteConfig } from "@/lib/site-config";

export const dynamic = "force-dynamic";

export async function GET() {
  const xml = await renderRssFeed({
    description: `آخرین اخبار و مطالب ${siteConfig.name}`,
    sectionPath: "/",
    feedPath: "/rss.xml",
  });
  return xmlResponse(xml, 900);
}
