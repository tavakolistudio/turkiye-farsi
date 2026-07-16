import { siteConfig } from "@/lib/site-config";
import { siteOrigin, ogImageUrl } from "@/lib/seo/urls";
import type { PublisherInfo } from "@/server/services/site-settings.service";

/**
 * schema.org structured-data builders. Every builder returns a plain JSON
 * object (rendered later as JSON-LD). Builders NEVER invent data: optional
 * fields are only included when a real value exists. URLs must already be
 * absolute (use the seo/urls helpers at the call site).
 */

type Json = Record<string, unknown>;

const ORG_ID = () => `${siteOrigin()}/#organization`;
const WEBSITE_ID = () => `${siteOrigin()}/#website`;

/** Drop undefined/empty keys so no null/blank fields leak into the output. */
function clean<T extends Json>(obj: T): T {
  const out: Json = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out as T;
}

export function organizationSchema(pub: PublisherInfo): Json {
  const name = pub.siteName || siteConfig.name;
  const logo = ogImageUrl(pub.logo || "/images/logo.svg");
  const contactPoint =
    pub.contactEmail || pub.contactPhone
      ? clean({
          "@type": "ContactPoint",
          contactType: "editorial",
          email: pub.contactEmail,
          telephone: pub.contactPhone,
        })
      : undefined;
  return clean({
    "@type": "NewsMediaOrganization",
    "@id": ORG_ID(),
    name,
    alternateName: pub.alternateName || siteConfig.nameEn,
    url: siteOrigin(),
    logo: clean({ "@type": "ImageObject", url: logo }),
    description: pub.description || siteConfig.description,
    foundingDate: pub.foundingDate,
    sameAs: pub.sameAs,
    contactPoint,
  });
}

export function websiteSchema(pub: PublisherInfo): Json {
  return clean({
    "@type": "WebSite",
    "@id": WEBSITE_ID(),
    url: siteOrigin(),
    name: pub.siteName || siteConfig.name,
    inLanguage: "fa-IR",
    publisher: { "@id": ORG_ID() },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${siteOrigin()}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  });
}

export interface PersonInput {
  name: string;
  url?: string;
  image?: string | null;
  description?: string | null;
  jobTitle?: string | null;
  sameAs?: string[];
}

export function personSchema(p: PersonInput): Json {
  return clean({
    "@type": "Person",
    name: p.name,
    url: p.url,
    image: p.image ? ogImageUrl(p.image) : undefined,
    description: p.description || undefined,
    jobTitle: p.jobTitle || undefined,
    sameAs: p.sameAs && p.sameAs.length ? p.sameAs : undefined,
  });
}

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export function breadcrumbSchema(items: BreadcrumbItem[]): Json {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}

export interface ArticleSchemaInput {
  type?: "NewsArticle" | "Article";
  headline: string;
  description?: string | null;
  url: string; // absolute canonical
  images: string[]; // absolute
  datePublished: string; // ISO
  dateModified?: string; // ISO
  author: PersonInput;
  section?: string | null;
  keywords?: string[];
}

export function articleSchema(a: ArticleSchemaInput, pub: PublisherInfo): Json {
  return clean({
    "@type": a.type ?? "NewsArticle",
    headline: a.headline.slice(0, 110),
    description: a.description || undefined,
    image: a.images.length ? a.images : [ogImageUrl(null)],
    datePublished: a.datePublished,
    dateModified: a.dateModified || a.datePublished,
    author: personSchema(a.author),
    publisher: organizationSchema(pub),
    mainEntityOfPage: { "@type": "WebPage", "@id": a.url },
    url: a.url,
    articleSection: a.section || undefined,
    keywords: a.keywords && a.keywords.length ? a.keywords.join(", ") : undefined,
    inLanguage: "fa-IR",
    isAccessibleForFree: true,
  });
}

export function newsArticleSchema(a: ArticleSchemaInput, pub: PublisherInfo): Json {
  return articleSchema({ ...a, type: "NewsArticle" }, pub);
}

/** Wrap one or more schema objects into a single @graph document. */
export function graph(...nodes: (Json | null | undefined)[]): Json {
  return {
    "@context": "https://schema.org",
    "@graph": nodes.filter((n): n is Json => !!n),
  };
}

/** Serialize JSON-LD safely for embedding in a <script> tag (prevents </script> breakout). */
export function serializeJsonLd(data: Json): string {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}
