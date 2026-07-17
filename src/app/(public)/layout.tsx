import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { BreakingBar } from "@/components/public/breaking-bar";
import { JsonLd } from "@/components/seo/json-ld";
import { siteSettingsService } from "@/server/services/site-settings.service";
import { graph, organizationSchema, websiteSchema } from "@/lib/seo/jsonld";
import { headers } from "next/headers";
import { AnalyticsScripts } from "@/components/analytics/analytics-scripts";

/**
 * Chrome for the public website: sticky header + main nav, breaking-news bar,
 * the page content, and the footer. RTL and lang=fa come from the root layout;
 * the skip link there targets #main-content below. Site-wide Organization +
 * WebSite (with SearchAction) structured data is emitted once here.
 */
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const [publisher, requestHeaders] = await Promise.all([siteSettingsService.publisher(), headers()]);
  const siteGraph = graph(organizationSchema(publisher), websiteSchema(publisher));

  return (
    <>
      <JsonLd data={siteGraph} />
      <AnalyticsScripts nonce={requestHeaders.get("x-nonce") ?? undefined} />
      <SiteHeader />
      <BreakingBar />
      <main id="main-content" className="editorial-shell w-full flex-1 py-6 md:py-10">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
