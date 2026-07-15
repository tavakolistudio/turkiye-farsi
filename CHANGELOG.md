# Changelog

All notable changes to Turkey Farsi (ترکیه فارسی). Phased delivery.

## Phase 7 — Technical SEO & news discovery
### Added
- **Dynamic metadata** for every public page via `buildMetadata`
  (`src/lib/seo/metadata.ts`): guaranteed non-empty title/description, absolute
  canonical from `NEXT_PUBLIC_SITE_URL`, Open Graph (article tags for news) and
  Twitter cards. Pagination self-canonicals; search + thin/empty pages `noindex`.
- **Structured data (JSON-LD)** — `NewsArticle`, `Article`, `BreadcrumbList`,
  `Person`, `NewsMediaOrganization`, `WebSite`+`SearchAction`
  (`src/lib/seo/jsonld.ts`, nonce-aware `JsonLd` component). Published-only,
  real dates, publisher from `SiteSetting`, no fabricated fields.
- **Sitemaps**: index `/sitemap.xml` + per-type `/sitemaps/{pages,categories,
  tags,authors,articles}.xml` (published-only, real `lastmod`, absolute URLs,
  article chunking at 20k).
- **Google News sitemap** `/news-sitemap.xml` — last-48h published articles with
  the `news:` namespace and `fa` publication language.
- **RSS**: `/rss.xml`, `/rss/latest.xml`, `/rss/breaking.xml`,
  `/rss/category/{slug}.xml` — escaped/CDATA, published-only, enclosures.
- **Dynamic `robots.txt`** (`src/app/robots.ts`) — production crawlable
  (admin/api/preview disallowed, sitemaps advertised); preview/dev `Disallow: /`.
- **Redirect manager** — `Redirect`-backed resolver with chain following, cycle
  detection (→404), and 308/307 wiring on dynamic-page misses.
- **Docs**: `SEO.md`, `DEPLOYMENT.md`, and Google News/Discover checklists.
- **Tests**: SEO unit + integration; 16 E2E scenarios that parse XML feeds with
  the browser DOMParser (not just status checks).

## Phase 6 — Public website
### Added
- Public route group `(public)` with RTL layout (header, nav, accessible mobile
  menu, search, breaking-news bar, footer) and the homepage.
- Routes: `/news`, `/news/[slug]`, `/category/[slug]`, `/tag/[slug]`,
  `/author/[slug]`, `/latest`, `/breaking`, `/most-viewed`, `/search`, and the
  institutional static pages. Safe public TipTap renderer (embed allowlist),
  session-deduped view counting, real search with `SearchLog`.
- `StaticPage` model + idempotent seed; public API for view/search/breaking/
  most-viewed/author.

## Phase 5 — Editorial workflow
### Added
- Editorial workflow (review queue, scheduling, revisions, corrections),
  TipTap newsroom UI, secure workflow APIs, and preview tokens.

## Phase 4 — CMS content core
### Added
- **Models**: full `Article` (editorial + SEO + social fields), `Category`
  (parent/child, image, isActive), `Tag` (description, soft delete), `Source`
  (type, credibility, official), `Media` + `MediaFolder`. Join models
  `ArticleCategory` (primary/order), `ArticleTag`, `ArticleSource`, `ArticleMedia` (role/order).
- **Enums**: `ContentType` (NEWS/NOTICE renames), `FactCheckStatus`,
  `ArticleSourceStatus`, `SourceType`, `CredibilityLevel`, `MediaRole`; compile-checked
  runtime arrays in `content-enums.ts`.
- **Service layer** (`*.service.ts`) + **DAL** (`*.repo.ts`) for all five models —
  create/update/get/list/softDelete/restore with server-side authz, Zod validation,
  slug generation (Persian-aware, unique, locked after publish) and audit logging.
- **Storage adapter** interface + Local (dev) and Supabase adapters; MIME allowlist,
  25 MB cap, safe filenames, path-traversal & executable/SVG rejection.
- **REST API v1**: admin CRUD (`/api/v1/admin/*`) and public read/headless API
  (`/api/v1/public/*`, rate-limited, PUBLISHED-only) with a standard response envelope
  and stable error codes.
- **Admin UI**: `/admin/{articles,categories,tags,sources,media}` with search,
  filter, sort, pagination, create/edit, soft-delete/restore, permission-aware actions,
  real media upload, and empty/loading/error states.
- **RBAC**: granular content permissions (article/category/tag/source/media) assigned to roles.
- **Tests**: unit (validation, media security, slug), integration (content services,
  circular parent, tag merge, source/media attach, public-only), E2E (admin CRUD +
  real upload + permission denial).
- **Docs**: DATABASE, ARCHITECTURE, API, ADMIN_GUIDE.

## Phase 3 — Authentication, RBAC & hardening
### Added
- DB-backed sessions (SHA-256 tokens, HTTP-only cookies), scrypt passwords,
  login/logout/forgot/reset/change-password, login rate limiting, audit logging.
- Server-side authorization on every admin page & action; coarse `/admin` gate in proxy.
- Security headers (nonce CSP, HSTS, nosniff, Referrer-Policy, Permissions-Policy,
  frame-ancestors) on all routes; CSRF Origin/Host checks; cron/webhook secret verifier.
- User management (deactivate, revoke sessions). Playwright E2E for auth/authz.

## Phase 2 — Database backbone
- Full Prisma schema, initial migration, idempotent seed (roles, permissions,
  super admin from env, categories, sample content).

## Phase 1 — Project setup
- Next.js 16 + TypeScript + Tailwind v4, RTL/fa, Vazirmatn, theme + design tokens,
  local embedded Postgres (Supabase-ready).
