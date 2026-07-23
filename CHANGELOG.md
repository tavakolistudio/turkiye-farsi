# Changelog

All notable changes to Turkey Farsi (ترکیه فارسی). Phased delivery.

## Phase 10A — AI Editorial Newsroom (collection · dedup · scoring · draft queue)
### Added
- **Ingestion data model**: extended `Source` (feed URL, collection method, trust
  level, enable/fetch bookkeeping) plus `IngestedNewsItem`, `NewsFetchBatch`,
  `NewsPipelineJobLog`, `NewsStoryCluster(+Item)`, `NewsDraftProvenance`. Additive
  migrations with RLS on the new tables.
- **Safe collection pipeline**: SSRF-hardened fetch (public-IP-only, per-redirect
  re-validation, size/timeout/redirect caps, conditional GET), XXE-safe feed
  parsing (RSS/Atom/JSON), Persian normalization, tracking-free URL canonical.
- **Dedup + clustering** (5 levels), **explainable importance scoring**
  (configurable weights, 0–100 buckets), **trust evaluation** (social cap,
  official rules, legal-claim fact-check).
- **AI provider abstraction** (Disabled/Mock/OpenAI) with Zod-validated output,
  prompt-injection boundaries, token/cost accounting and a daily budget guard.
  **Copyright-safe Persian draft** builder — DRAFT-only, with source attribution.
- **Review queue** `/admin/newsroom`, permission-gated admin API, and a
  `CRON_SECRET`-protected daily collection cron. Real kill switches
  (`NewsroomSettings`); AI and collection default OFF.
- Docs: `AI_NEWSROOM.md`, `NEWSROOM_SOURCES_POLICY.md`, permanent rules in
  `AGENTS.md`. 40 unit tests.
### Added (completion pass)
- **Settings admin** (kill switches, limits, scoring weights, reset), **source
  collection management** (feed/method/trust/enable, SSRF-safe Test Feed, ETag/
  Last-Modified/failure status, real conditional GET), **reprocess** &
  **regenerate** (revision-safe, refuses to clobber human edits), **cluster
  merge/split**, and **retention cleanup** (dry-run, advisory-locked, second
  `CRON_SECRET` cron).
- Fixes: identical cross-source stories now cluster (multi-source confirmation)
  instead of being dropped; RBAC/CSRF errors map to 401/403/400 not 500; the
  header market-ticker uses `useSyncExternalStore` (lint clean).
- Coverage: 40 unit + 9 integration + 6 E2E, all green on local embedded
  Postgres (never production).
### Added (final review pass — merge readiness)
- **AI actually wired in**: `createDraftFromItem`/`regenerateDraft` now call
  the (previously unused) AI provider for the Persian draft text when
  `aiEnabled`, the item clears `minScoreForAI`, and the daily budget guard has
  room; any AI failure/disabled/budget-exhausted state falls back silently to
  the rule-based draft. Real generation cost recorded on
  `NewsDraftProvenance`, rolled into the daily budget total. Importance
  scoring, classification and trust evaluation remain rule-based.
- **Observability**: `/admin/newsroom/runs` (+ `/[id]`) surfaces
  `NewsFetchBatch` history and per-stage `NewsPipelineJobLog` entries
  (previously write-only), gated by the `newsroom.view_logs` permission.
- **`NEWSROOM_SOURCE_CONFLICT`** wired to `trust.verificationStatus ===
  "CONFLICTING"` (currently dormant — no detector sets that condition yet;
  the notification path itself is tested).
- **Cron consolidation for Vercel Hobby**: collection + cleanup combined into
  one daily `/api/cron/newsroom-dispatch` job (`vercel.json` now registers 2
  crons total: this + the pre-existing `/api/cron/publish`). The individual
  routes still exist, CRON_SECRET-protected, for manual/ops use.
- Fixes: a hardcoded test tokenHash collided with a leftover row from an
  interrupted run; a stale e2e dark-mode color assertion left over from an
  earlier theme; an e2e revision-restore race against a benign, expected
  optimistic-concurrency conflict now retries like a real client would.
- Coverage: 199 unit/integration + 71 E2E, all green on local embedded
  Postgres (never production/Supabase).
### Guarantees
- No auto-publish, no AI images, no social auto-posting, no full copyrighted
  text stored, no scraping of disallowed sources.

## Production deployment (Vercel)
### Changed
- `vercel-build` is now `prisma migrate deploy && next build` — migrations apply
  automatically on deploy, but the **seed no longer runs during the build**.
  Seeding is a controlled, idempotent manual step (`npm run db:seed` with
  `NODE_ENV=production`). Deploys no longer depend on `INITIAL_ADMIN_*`.
### Added
- **Scheduled-publish cron**: `vercel.json` registers `/api/cron/publish` at
  `0 * * * *` (hourly). The route accepts `GET` (Vercel Cron) and `POST`, both
  behind a constant-time `CRON_SECRET` Bearer check that fails closed; the run is
  idempotent (atomic claim) and logs to `PublishJobLog`.
- **`SECURITY.md`** — security posture and reporting.
- **DEPLOYMENT.md** — production smoke-test, rollback, secret-rotation and
  incident checklists; corrected the build-step description.

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
  detection (→404), automatic old-slug preservation, and 301/307 wiring.
- **Docs**: `SEO.md`, `DEPLOYMENT.md`, and Google News/Discover checklists.
- **Tests**: SEO unit + integration; 16 E2E scenarios that parse XML feeds with
  the browser DOMParser (not just status checks).
- **Security**: enable RLS (deny-by-default) on all public tables so the
  Supabase Data API exposes nothing; Prisma (owner role) bypasses it, app
  unaffected. Resolves the "RLS disabled in public" advisor.

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
