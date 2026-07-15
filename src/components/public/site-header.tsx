import Link from "next/link";
import { siteConfig } from "@/lib/site-config";
import { routes } from "@/lib/public-links";
import { publicSiteService } from "@/server/services/public-site.service";
import { SearchBox } from "./search-box";
import { MobileMenu } from "./mobile-menu";

/** Primary navigation shown on desktop; the same items feed the mobile menu. */
const PRIMARY_LINKS = [
  { name: "آخرین اخبار", href: routes.latest() },
  { name: "اخبار فوری", href: routes.breaking() },
  { name: "پربازدیدها", href: routes.mostViewed() },
];

export async function SiteHeader() {
  const categories = await publicSiteService.navCategories();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4">
        <MobileMenu categories={categories.map((c) => ({ name: c.name, slug: c.slug }))} />

        <Link href={routes.home()} className="flex shrink-0 flex-col leading-none">
          <span className="text-xl font-extrabold tracking-tight">{siteConfig.name}</span>
          <span className="text-[10px] text-muted-foreground">{siteConfig.nameEn}</span>
        </Link>

        <nav aria-label="ناوبری اصلی" className="mr-auto hidden items-center gap-1 md:flex">
          {categories.slice(0, 6).map((c) => (
            <Link
              key={c.slug}
              href={routes.category(c.slug)}
              className="rounded-md px-2.5 py-1.5 text-sm font-medium hover:bg-accent"
            >
              {c.name}
            </Link>
          ))}
        </nav>

        <div className="mr-auto md:mr-0">
          <SearchBox />
        </div>
      </div>

      <div className="border-t border-border bg-muted/40">
        <div className="mx-auto flex h-10 w-full max-w-6xl items-center gap-4 overflow-x-auto px-4 text-sm">
          {PRIMARY_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="shrink-0 font-medium text-muted-foreground hover:text-primary">
              {l.name}
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
}
