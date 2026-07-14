/**
 * Central site configuration. Values that vary per environment are read from
 * env vars (never hardcoded), with safe fallbacks for local development.
 * Admin-editable settings (logo, footer text, socials) live in the SiteSetting
 * table and are layered on top of these defaults at runtime.
 */
export const siteConfig = {
  name: process.env.NEXT_PUBLIC_SITE_NAME || "ترکیه فارسی",
  nameEn: "Turkey Farsi",
  description:
    "رسانه خبری و آموزشی فارسی‌زبان برای ایرانیان ساکن ترکیه — اخبار، اقامت، قوانین، اقتصاد، سفر و رویدادهای ترکیه.",
  url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  locale: "fa_IR",
  direction: "rtl" as const,
  timeZone: "Europe/Istanbul",
  defaultOgImage: "/og-default.png",
} as const;

export type SiteConfig = typeof siteConfig;
