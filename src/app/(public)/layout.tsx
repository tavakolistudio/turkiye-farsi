import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { BreakingBar } from "@/components/public/breaking-bar";

/**
 * Chrome for the public website: sticky header + main nav, breaking-news bar,
 * the page content, and the footer. RTL and lang=fa come from the root layout;
 * the skip link there targets #main-content below.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <BreakingBar />
      <main id="main-content" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
