import { renderRssFeed } from "@/lib/seo/rss-feed";
import { xmlResponse } from "@/lib/seo/xml";
import { siteConfig } from "@/lib/site-config";

export const dynamic = "force-dynamic";

export async function GET() {
  const xml = await renderRssFeed({
    titleSuffix: "اخبار فوری",
    description: `اخبار فوری ${siteConfig.name}`,
    sectionPath: "/breaking",
    feedPath: "/rss/breaking.xml",
    breaking: true,
  });
  return xmlResponse(xml, 600);
}
