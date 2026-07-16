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
        </section>

        <nav aria-label="دسته‌بندی‌های مهم">
          <h2>دسته‌بندی‌ها</h2>
          <ul>{categories.slice(0, 7).map((category) => (
            <li key={category.slug}><Link href={routes.category(category.slug)}>{category.name}</Link></li>
          ))}</ul>
        </nav>

        <nav aria-label="صفحات رسانه">
          <h2>رسانه</h2>
          <ul>
            <li><Link href={routes.latest()}>آخرین اخبار</Link></li>
            <li><Link href={routes.breaking()}>اخبار فوری</Link></li>
            <li><Link href={routes.mostViewed()}>پربازدیدها</Link></li>
            <li><Link href="/rss.xml">RSS</Link></li>
            {STATIC_PAGES.map((page) => <li key={page.slug}><Link href={routes.page(page.slug)}>{page.title}</Link></li>)}
          </ul>
        </nav>

        <section>
          <h2>تماس و شبکه‌ها</h2>
          <ul>
            {settings.general.email && <li><a href={`mailto:${settings.general.email}`}>{settings.general.email}</a></li>}
            {settings.general.phone && <li><a href={`tel:${settings.general.phone}`}>{settings.general.phone}</a></li>}
            {settings.general.address && <li><address>{settings.general.address}</address></li>}
            {socials.map(([key, url]) => (
              <li key={key}><a href={url} target="_blank" rel="noopener noreferrer">{SOCIAL_LABELS[key] ?? key}</a></li>
            ))}
          </ul>
        </section>
      </div>
      <div className="editorial-shell editorial-copyright">{copyright}</div>
    </footer>
  );
}
