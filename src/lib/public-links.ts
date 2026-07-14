/**
 * Canonical public URL builders. Slugs may contain Persian characters, so each
 * dynamic segment is percent-encoded to stay a valid URL in server-rendered
 * markup (Next's <Link> also encodes, but explicit encoding keeps raw <a> and
 * canonical/OG URLs correct too).
 */
const seg = (s: string) => encodeURIComponent(s);

export const routes = {
  home: () => "/",
  news: () => "/news",
  latest: () => "/latest",
  breaking: () => "/breaking",
  mostViewed: () => "/most-viewed",
  search: (q?: string) => (q ? `/search?q=${encodeURIComponent(q)}` : "/search"),
  article: (slug: string) => `/news/${seg(slug)}`,
  category: (slug: string) => `/category/${seg(slug)}`,
  tag: (slug: string) => `/tag/${seg(slug)}`,
  author: (slug: string) => `/author/${seg(slug)}`,
  page: (slug: string) => `/${seg(slug)}`,
} as const;

/** The 7 institutional static pages, in footer display order. */
export const STATIC_PAGES: { slug: string; title: string }[] = [
  { slug: "about", title: "درباره ما" },
  { slug: "contact", title: "تماس با ما" },
  { slug: "advertising", title: "تبلیغات" },
  { slug: "cooperation", title: "همکاری با ما" },
  { slug: "privacy", title: "حریم خصوصی" },
  { slug: "terms", title: "قوانین و مقررات" },
  { slug: "corrections-policy", title: "سیاست اصلاح اخبار" },
];
