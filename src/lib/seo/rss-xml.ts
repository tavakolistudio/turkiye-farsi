import { xmlEscape, cdata } from "@/lib/seo/xml";

export interface RssChannel {
  title: string;
  link: string; // absolute site/section URL
  feedUrl: string; // absolute self URL
  description: string;
  language?: string;
}

export interface RssItem {
  title: string;
  link: string; // absolute
  guid: string; // absolute, permalink
  description?: string | null;
  pubDate?: Date | null;
  author?: string | null;
  category?: string | null;
  image?: string | null; // absolute enclosure URL
}

/** MIME type for an image URL, from its extension (defaults to jpeg). */
export function imageMimeType(url: string): string {
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase();
  switch (ext) {
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "svg":
      return "image/svg+xml";
    default:
      return "image/jpeg";
  }
}

/**
 * Build an RSS 2.0 feed. All text is escaped (titles/categories) or wrapped in
 * CDATA (descriptions) — no raw HTML or scripts pass through. Only well-formed
 * absolute URLs are emitted; images become <enclosure> only when present.
 */
export function buildRss(channel: RssChannel, items: RssItem[]): string {
  const lang = channel.language ?? "fa-IR";
  const now = new Date().toUTCString();

  const itemXml = items
    .map((it) => {
      const parts = [
        `      <title>${xmlEscape(it.title)}</title>`,
        `      <link>${xmlEscape(it.link)}</link>`,
        `      <guid isPermaLink="true">${xmlEscape(it.guid)}</guid>`,
      ];
      if (it.pubDate) parts.push(`      <pubDate>${it.pubDate.toUTCString()}</pubDate>`);
      if (it.author) parts.push(`      <dc:creator>${cdata(it.author)}</dc:creator>`);
      if (it.category) parts.push(`      <category>${xmlEscape(it.category)}</category>`);
      if (it.description) parts.push(`      <description>${cdata(it.description)}</description>`);
      if (it.image) {
        parts.push(`      <enclosure url="${xmlEscape(it.image)}" type="${imageMimeType(it.image)}" />`);
      }
      return `    <item>\n${parts.join("\n")}\n    </item>`;
    })
    .join("\n");

  return `<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xmlEscape(channel.title)}</title>
    <link>${xmlEscape(channel.link)}</link>
    <atom:link href="${xmlEscape(channel.feedUrl)}" rel="self" type="application/rss+xml" />
    <description>${xmlEscape(channel.description)}</description>
    <language>${xmlEscape(lang)}</language>
    <lastBuildDate>${now}</lastBuildDate>
${itemXml}
  </channel>
</rss>`;
}
