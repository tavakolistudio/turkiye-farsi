import Link from "next/link";
import { siteConfig } from "@/lib/site-config";
import { routes } from "@/lib/public-links";
import { publicSiteService } from "@/server/services/public-site.service";
import { SearchBox } from "./search-box";
import { MobileMenu } from "./mobile-menu";
import { MainNavigation, type NavigationItem } from "./main-navigation";
import { ThemeToggle } from "./theme-toggle";
import { formatJalali } from "@/lib/dates";

/** Primary navigation shown on desktop; the same items feed the mobile menu. */
const PRIMARY_LINKS: NavigationItem[] = [
  { name: "آخرین اخبار", href: routes.latest() },
  { name: "اخبار فوری", href: routes.breaking() },
  { name: "پربازدیدها", href: routes.mostViewed() },
];

export async function SiteHeader() {
  const categories = await publicSiteService.navCategories();
  const categoryLinks = categories.slice(0, 9).map((category) => ({
    name: category.name,
    href: routes.category(category.slug),
  }));
  const navigation = [...categoryLinks, ...PRIMARY_LINKS].filter(
    (item, index, items) => items.findIndex((candidate) => candidate.href === item.href) === index,
  );

  return (
    <header className="editorial-header">
      <div className="editorial-utility">
        <div className="editorial-shell">
          <p><time dateTime={new Date().toISOString()}>{formatJalali(new Date())}</time></p>
          <nav aria-label="پیوندهای رسانه">
            <Link href={routes.page("about")}>درباره ما</Link>
            <Link href={routes.page("contact")}>تماس</Link>
            <Link href="/admin/login">ورود</Link>
            <ThemeToggle />
          </nav>
        </div>
      </div>

      <div className="editorial-masthead editorial-shell">
        <MobileMenu items={navigation} />
        <Link href={routes.home()} className="editorial-wordmark" aria-label={`${siteConfig.name}، صفحه اصلی`}>
          <strong>{siteConfig.name}</strong>
          <span>روایت دقیق زندگی و خبر در ترکیه</span>
        </Link>
        <div className="editorial-masthead-search"><SearchBox /></div>
      </div>

      <div className="editorial-nav-row">
        <div className="editorial-shell">
          <MainNavigation items={navigation} />
          <div className="editorial-nav-search"><SearchBox /></div>
        </div>
      </div>
    </header>
  );
}
