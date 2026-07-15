# SEO & News Discovery

Phase 7 adds the technical SEO layer for Turkey Farsi (ترکیه فارسی): dynamic
metadata, structured data, sitemaps, a Google-News sitemap, RSS feeds, a dynamic
`robots.txt`, canonical rules, and a redirect manager. Everything reads **real**
data and builds absolute URLs from `NEXT_PUBLIC_SITE_URL` — nothing is hardcoded
or fabricated.

## Metadata strategy

- Central builder: `src/lib/seo/metadata.ts` (`buildMetadata`). Guarantees a
  non-empty title/description, an absolute canonical, Open Graph, and a Twitter
  `summary_large_image` card.
- Titles flow through the root layout template `"%s | ترکیه فارسی"`; the
  homepage opts out with `absoluteTitle`.
- Per page:
  - `/` — site title + description.
  - `/news/[slug]` — article title/summary; OG `type=article` with
    `published_time`, `modified_time`, `author`, `section`, `tag`; `noindex`
    honours the article's own `noindex` flag.
  - `/category/[slug]`, `/tag/[slug]` — self-referencing canonical **including
    the pagination `page` param**; thin tag archives (0 published articles) are
    `noindex`.
  - `/author/[slug]` — author name/bio, avatar OG image.
  - `/search` — always `noindex, follow`.
  - Static pages — DB title/meta; empty/stub pages are `noindex`.
- `/admin/*` is gated (login) and disallowed in robots; `/preview/*` sends
  `X-Robots-Tag: noindex` (see `next.config.ts`).

## Canonical strategy

`src/lib/seo/urls.ts`:

- `absoluteUrl(path)` — root-relative → absolute; rejects `//` and invalid input.
- `canonicalUrl(path, allowParams?)` — absolute, **drops all query params**
  except an explicit allowlist (pagination `page`, and `page=1` is normalised
  away). Tracking params (`utm_*`, etc.) never appear in a canonical.
- Articles canonicalise to their own URL, or to a stored `canonicalUrl`
  (syndication) when present.
- Paginated list pages canonicalise to themselves (`?page=N`).

## Structured data (JSON-LD)

Builders in `src/lib/seo/jsonld.ts`, rendered by `src/components/seo/json-ld.tsx`
(nonce-aware `<script type="application/ld+json">`, with `<`/`>`/`&` escaped so
content can't break out).

- **Site-wide** (public layout): `NewsMediaOrganization` + `WebSite` with a
  `SearchAction` targeting `/search?q={search_term_string}`.
- **Article**: `NewsArticle` (+ `Article` semantics) with `headline`,
  `description`, `image`, `datePublished`, `dateModified`, `author` (Person),
  `publisher` (Organization), `mainEntityOfPage`, `articleSection`, `keywords`,
  `inLanguage: fa-IR`, `isAccessibleForFree: true`, plus a `BreadcrumbList`.
- **Author**: `Person` (name, url, image, bio, jobTitle, public `sameAs`) +
  `BreadcrumbList`.
- **Category / Tag / Static**: `BreadcrumbList`.

Rules: only **published** articles emit article schema; dates are the real
stored values (`dateModified` falls back to `datePublished`, never faked);
publisher data comes from `SiteSetting`; optional fields are omitted when absent
(no fabricated `foundingDate`, phone, or social links).

## Sitemaps

- `/sitemap.xml` — **sitemap index** referencing the child sitemaps and the news
  sitemap.
- `/sitemaps/pages.xml`, `/sitemaps/categories.xml`, `/sitemaps/tags.xml`,
  `/sitemaps/authors.xml`, `/sitemaps/articles.xml` — per-type `urlset`s with
  real `lastmod`, absolute URLs, **published-only** content.
  - Tags/authors are included only when they have ≥1 published article.
  - Articles are **chunked** at `SITEMAP_CHUNK` (20k) URLs via
    `/sitemaps/articles.xml?p=N`; the index lists one entry per chunk, so the
    structure scales to hundreds of thousands of URLs.
- Data: `src/server/services/seo-feed.service.ts`; XML: `src/lib/seo/sitemap-xml.ts`.

## News sitemap (Google News)

- `/news-sitemap.xml` — `urlset` with the `news:` namespace.
- Contains **only published articles from the last 48 hours** (Google News
  window), each with `<news:publication>` (name from `SiteSetting`, language
  `fa`), `<news:publication_date>`, and `<news:title>`.
- Short cache (10 min) so fresh articles surface quickly. Never includes drafts,
  scheduled, future-dated, or older-than-48h articles.

## RSS feeds

- `/rss.xml` — latest published (site-wide).
- `/rss/latest.xml` — alias for the latest feed.
- `/rss/breaking.xml` — breaking news only.
- `/rss/category/{slug}.xml` — per-category.

Each `<item>`: `title`, `link`, `guid` (permalink), `pubDate` (RFC-822),
`dc:creator`, `category`, `description` (CDATA), and an `<enclosure>` when a
valid image exists. Text is escaped/CDATA-wrapped — no raw HTML, scripts, or
admin data. Published-only, absolute URLs. Builder: `src/lib/seo/rss-xml.ts`.

## robots.txt

`src/app/robots.ts` (dynamic):

- **Production** (`VERCEL_ENV=production`, or a production build on a non-local
  origin): `Allow: /` with `Disallow` for `/admin`, `/api/`, `/preview`, and
  `utm_` query URLs; lists `/sitemap.xml` and `/news-sitemap.xml`; sets `host`.
- **Non-production / preview**: `Disallow: /` (staging is never indexed).

## Redirect manager

- Model: `Redirect` (`from` unique, `to`, `permanent`).
- Resolver: `src/server/services/redirect.service.ts` — follows chains
  (A→B→C) up to 10 hops, **detects cycles and returns null (404)** instead of
  emitting a redirect that would ping-pong.
- Wiring: `src/server/seo/redirect-or-404.ts` — dynamic public pages
  (article/category/tag/author) consult the table on a miss and issue a **308**
  (permanent) or **307** (temporary), else `notFound()`. Non-ASCII destinations
  are percent-encoded for a valid `Location` header. Runs in the Node runtime,
  not edge middleware.

## Image SEO

- `next/image` via `PostImage`, with responsive `sizes`, `loading="lazy"`, fixed
  aspect-ratio containers (limits CLS), and a neutral placeholder when no image.
- Schema/OG images are absolute (`ogImageUrl`) and fall back to
  `siteConfig.defaultOgImage`.
- Sample media use a committed placeholder (`/images/news-placeholder.svg`); the
  org logo is `/images/logo.svg` (replace with the real brand asset). Real
  uploads come from Storage in production — nothing is fabricated when Storage
  isn't configured.

## Required `SiteSetting` fields

The `general` setting (JSON) powers Organization schema, the publisher block,
and feeds. All optional — missing values are simply omitted:

| field | used for |
| --- | --- |
| `siteName` | Organization/WebSite name, feed titles, News publication name |
| `alternateName` | Organization `alternateName` |
| `description` | Organization/site description |
| `logo` | Organization logo (absolute or root-relative; else default logo) |
| `foundingDate` | Organization `foundingDate` (only if set) |
| `email`, `phone` | Organization `contactPoint` (only if set) |
| `socials.{telegram,instagram,x,whatsapp}` | Organization `sameAs` (**absolute URLs only**) |

## Google News readiness checklist

This makes the site *eligible* — it does **not** guarantee inclusion.

- [x] Clear author name + public author pages (`Person` schema).
- [x] Real `datePublished` / `dateModified`.
- [x] About, Contact, and Corrections-policy pages.
- [x] Sources listed on articles.
- [x] `NewsArticle` structured data.
- [x] News sitemap (48h) + standard sitemaps.
- [x] RSS feeds.
- [x] Canonical URLs, no draft/preview leakage.
- [x] Large featured image where available.
- [ ] **Manual**: submit the publication in Google Publisher Center.
- [ ] **Manual**: verify the domain in Google Search Console (real value).

## Google Discover readiness checklist

- [x] High-quality unique content with clear titles.
- [x] Large, high-resolution images (via Storage in production).
- [x] Author/E-E-A-T signals (author pages, bios, expertise).
- [x] Mobile-friendly, fast, RTL pages.
- [x] Structured data + canonical + Open Graph.
- [ ] **Manual/ongoing**: content freshness and engagement (editorial, not code).

## Testing

- Unit: URL/canonical builders, metadata fallbacks, XML escaping, sitemap/news
  XML, RSS sanitisation, JSON-LD builders, redirect-path normalisation.
- Integration: sitemap/news/RSS feed data (published-only, 48h window),
  redirect chain + loop, robots policy per environment.
- E2E: feeds are **parsed with the browser DOMParser** (not just 200-checked),
  plus canonical/JSON-LD/OG/noindex, draft 404, redirect 308, loop 404, and
  no-admin-field-leak assertions.
