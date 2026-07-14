import Link from "next/link";
import { siteConfig } from "@/lib/site-config";
import { routes, STATIC_PAGES } from "@/lib/public-links";
import { publicSiteService } from "@/server/services/public-site.service";
import { siteSettingsService } from "@/server/services/site-settings.service";

export async function SiteFooter() {
  const [categories, settings] = await Promise.all([
    publicSiteService.navCategories(),
    siteSettingsService.get(),
  ]);

  const about = settings.footer.about || siteConfig.description;
  const copyright =
    settings.footer.copyright || `© ${siteConfig.name} — همه حقوق محفوظ است.`;

  return (
    <footer className="mt-16 border-t border-border bg-muted/40">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <p className="text-lg font-extrabold">{siteConfig.name}</p>
          <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">{about}</p>
        </div>

        <nav aria-label="دسته‌بندی‌ها">
          <h2 className="mb-3 text-sm font-bold">دسته‌بندی‌ها</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {categories.slice(0, 6).map((c) => (
              <li key={c.slug}>
                <Link href={routes.category(c.slug)} className="hover:text-primary">{c.name}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="بخش‌ها">
          <h2 className="mb-3 text-sm font-bold">بخش‌ها</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link href={routes.latest()} className="hover:text-primary">آخرین اخبار</Link></li>
            <li><Link href={routes.breaking()} className="hover:text-primary">اخبار فوری</Link></li>
            <li><Link href={routes.mostViewed()} className="hover:text-primary">پربازدیدترین‌ها</Link></li>
            <li><Link href={routes.news()} className="hover:text-primary">همه اخبار</Link></li>
          </ul>
        </nav>

        <nav aria-label="درباره">
          <h2 className="mb-3 text-sm font-bold">درباره</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {STATIC_PAGES.map((p) => (
              <li key={p.slug}>
                <Link href={routes.page(p.slug)} className="hover:text-primary">{p.title}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto w-full max-w-6xl px-4 py-4 text-center text-xs text-muted-foreground">
          {copyright}
        </div>
      </div>
    </footer>
  );
}
