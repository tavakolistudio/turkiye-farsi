import { xmlEscape } from "@/lib/seo/xml";

/** <sitemapindex> referencing child sitemaps. */
export function sitemapIndexXml(entries: { loc: string; lastmod?: Date }[]): string {
  const body = entries
    .map(
      (e) =>
        `  <sitemap>\n    <loc>${xmlEscape(e.loc)}</loc>${
          e.lastmod ? `\n    <lastmod>${e.lastmod.toISOString()}</lastmod>` : ""
        }\n  </sitemap>`,
    )
    .join("\n");
  return `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>`;
}

export interface UrlEntry {
  loc: string;
  lastmod?: Date;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: number;
}

/** <urlset> of page URLs. */
export function urlsetXml(urls: UrlEntry[]): string {
  const body = urls
    .map((u) => {
      const parts = [`    <loc>${xmlEscape(u.loc)}</loc>`];
      if (u.lastmod) parts.push(`    <lastmod>${u.lastmod.toISOString()}</lastmod>`);
      if (u.changefreq) parts.push(`    <changefreq>${u.changefreq}</changefreq>`);
      if (typeof u.priority === "number") parts.push(`    <priority>${u.priority.toFixed(1)}</priority>`);
      return `  <url>\n${parts.join("\n")}\n  </url>`;
    })
    .join("\n");
  return `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>`;
}

export interface NewsItem {
  loc: string;
  title: string;
  publishedAt: Date;
}

/**
 * Google News sitemap. `publicationName` and `language` identify the outlet;
 * items must be recent (the caller filters to the last 48h).
 */
export function newsSitemapXml(items: NewsItem[], publicationName: string, language = "fa"): string {
  const body = items
    .map(
      (i) =>
        `  <url>\n    <loc>${xmlEscape(i.loc)}</loc>\n    <news:news>\n      <news:publication>\n        <news:name>${xmlEscape(
          publicationName,
        )}</news:name>\n        <news:language>${xmlEscape(
          language,
        )}</news:language>\n      </news:publication>\n      <news:publication_date>${i.publishedAt.toISOString()}</news:publication_date>\n      <news:title>${xmlEscape(
          i.title,
        )}</news:title>\n    </news:news>\n  </url>`,
    )
    .join("\n");
  return `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n${body}\n</urlset>`;
}
