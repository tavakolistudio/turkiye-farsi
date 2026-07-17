import type { Metadata } from "next";
import { siteConfig } from "@/lib/site-config";
import { canonicalUrl, ogImageUrl } from "@/lib/seo/urls";

/**
 * Shared page-metadata builder. Guarantees a non-empty title/description, a
 * canonical built from NEXT_PUBLIC_SITE_URL, and consistent Open Graph / Twitter
 * cards. `noindex` and OG `type=article` are opt-in per page.
 */
export interface BuildMetaInput {
  title: string;
  /** When true, the title bypasses the layout's "%s | site" template. */
  absoluteTitle?: boolean;
  description?: string | null;
  /** Root-relative path used for canonical + og:url. */
  path: string;
  /** Allowlisted query params kept on the canonical (e.g. pagination page). */
  canonicalParams?: Record<string, string | number | undefined>;
  image?: string | null;
  /** Admin-managed fallback (normally SiteSetting.general.logo). */
  fallbackImage?: string | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
  noindex?: boolean;
  ogType?: "website" | "article";
  publishedTime?: string;
  modifiedTime?: string;
  authors?: string[];
  section?: string;
  tags?: string[];
}

export function buildMetadata(input: BuildMetaInput): Metadata {
  const description = input.description?.trim() || siteConfig.description;
  const canonical = canonicalUrl(input.path, input.canonicalParams);
  const image = ogImageUrl(input.image || input.fallbackImage);

  return {
    title: input.absoluteTitle ? { absolute: input.title } : input.title,
    description,
    alternates: {
      canonical,
      languages: {
        "fa-IR": canonical,
        "x-default": canonical,
      },
    },
    robots: input.noindex
      ? { index: false, follow: true }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
            "max-video-preview": -1,
          },
        },
    openGraph: {
      type: input.ogType ?? "website",
      title: input.title,
      description,
      url: canonical,
      siteName: siteConfig.name,
      locale: siteConfig.locale,
      images: [{
        url: image,
        alt: input.title,
        ...(input.imageWidth && input.imageHeight
          ? { width: input.imageWidth, height: input.imageHeight }
          : {}),
      }],
      ...(input.ogType === "article"
        ? {
            publishedTime: input.publishedTime,
            modifiedTime: input.modifiedTime,
            authors: input.authors,
            section: input.section,
            tags: input.tags,
          }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description,
      images: [{ url: image, alt: input.title }],
    },
  };
}
