import Link from "next/link";
import { siteConfig } from "@/lib/site-config";
import { routes, STATIC_PAGES } from "@/lib/public-links";
import { publicSiteService } from "@/server/services/public-site.service";
import { siteSettingsService } from "@/server/services/site-settings.service";

const SOCIAL_LABELS: Record<string, string> = {
  telegram: "تلگرام",
  instagram: "اینستاگرام",
  x: "ایکس",
  whatsapp: "واتس‌اپ",
};

// Split the static pages so the columns stay balanced: editorial/company pages
// sit in a footer column, while policy pages move to the bottom bar (the
// conventional place for them) instead of bloating one column to 11 links.
const LEGAL_SLUGS = new Set(["privacy", "terms", "corrections-policy"]);
const ABOUT_PAGES = STATIC_PAGES.filter((p) => !LEGAL_SLUGS.has(p.slug));
const LEGAL_PAGES = STATIC_PAGES.filter((p) => LEGAL_SLUGS.has(p.slug));

export async function SiteFooter() {
  const [categories, settings] = await Promise.all([
    publicSiteService.navCategories(),
    siteSettingsService.get(),
  ]);
  const about = settings.footer.about || settings.general.description || siteConfig.description;
  const copyright = settings.footer.copyright || `© ${siteConfig.name} — همه حقوق محفوظ است.`;
  const socials = Object.entries(settings.general.socials ?? {}).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string" && /^https?:\/\//i.test(entry[1]),
  );

  return (
    <footer className="editorial-footer">
      <div className="editorial-shell editorial-footer-grid">
        <section className="editorial-footer-about">
          <p className="editorial-footer-wordmark">{siteConfig.name}</p>
          <p>{about}</p>

          <div className="editorial-footer-contact">
            {settings.general.email && (
              <a href={`mailto:${settings.general.email}`}>{settings.general.email}</a>
            )}
            {settings.general.phone && <a href={`tel:${settings.general.phone}`}>{settings.general.phone}</a>}
            {settings.general.address && <address>{settings.general.address}</address>}
          </div>

          {socials.length > 0 && (
            <nav className="editorial-footer-socials" aria-label="شبکه‌های اجتماعی">
              {socials.map(([key, url]) => (
                <a key={key} href={url} target="_blank" rel="noopener noreferrer">
                  {SOCIAL_LABELS[key] ?? key}
                </a>
              ))}
            </nav>
          )}
        </section>

        <nav aria-label="دسته‌بندی‌های مهم">
          <h2>دسته‌بندی‌ها</h2>
          <ul>{categories.slice(0, 7).map((category) => (
            <li key={category.slug}><Link href={routes.category(category.slug)}>{category.name}</Link></li>
          ))}</ul>
        </nav>

        <nav aria-label="بخش‌های خبری">
          <h2>بخش‌های خبری</h2>
          <ul>
            <li><Link href={routes.latest()}>آخرین اخبار</Link></li>
            <li><Link href={routes.breaking()}>اخبار فوری</Link></li>
            <li><Link href={routes.mostViewed()}>پربازدیدها</Link></li>
            <li><Link href={routes.news()}>همه مطالب</Link></li>
            <li><Link href="/rss.xml">خوراک RSS</Link></li>
          </ul>
        </nav>

        <nav aria-label="درباره ما">
          <h2>درباره</h2>
          <ul>
            {ABOUT_PAGES.map((page) => (
              <li key={page.slug}><Link href={routes.page(page.slug)}>{page.title}</Link></li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="editorial-shell editorial-footer-bottom">
        <p className="editorial-copyright-text">{copyright}</p>

        <nav className="editorial-footer-legal" aria-label="سیاست‌ها">
          {LEGAL_PAGES.map((page) => (
            <Link key={page.slug} href={routes.page(page.slug)}>{page.title}</Link>
          ))}
        </nav>

        <p className="editorial-powered">
          <a href="https://tavakolistudio.vercel.app/en" target="_blank" rel="noopener noreferrer">
            Powered by <strong>TAVAKOLISTUDIO</strong>
          </a>
        </p>
      </div>
    </footer>
  );
}
