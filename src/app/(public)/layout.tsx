import { getSiteChromeCached } from "@/server/services/public-cache";
import { PublicFooter, PublicHeader } from "@/components/public/public-shell";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const chrome = await getSiteChromeCached();
  return (
    <div className="public-site">
      <PublicHeader categories={chrome.categories} breaking={chrome.breaking} />
      <main id="main-content" className="public-main">{children}</main>
      <PublicFooter categories={chrome.categories} settings={chrome.settings} />
    </div>
  );
}
