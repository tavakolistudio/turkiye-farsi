# Deployment

Notes for deploying Turkey Farsi (ترکیه فارسی), with a focus on the SEO / news
discovery layer added in Phase 7.

## Environment variables (SEO-relevant)

| var | purpose |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | **Canonical origin.** Every canonical, OG, sitemap, feed, and schema URL is built from this. Must be the real production URL (e.g. `https://turkiyefarsi.com`). |
| `NEXT_PUBLIC_SITE_NAME` | Fallback site name. |
| `VERCEL_ENV` | On Vercel, gates indexability: only `production` is crawlable; preview/dev return `Disallow: /`. |

See `.env.example` for the full list (DB, Supabase, email, secrets).

## Indexability

- `robots.txt` is dynamic (`src/app/robots.ts`):
  - Production deployment → crawlable, sitemaps advertised.
  - Preview / development → `Disallow: /` so staging never gets indexed.
- Outside Vercel, indexing is enabled only for a production build served on a
  non-localhost origin. If you deploy elsewhere, ensure `NODE_ENV=production`
  and a real `NEXT_PUBLIC_SITE_URL`.

## Post-deploy checklist

1. Confirm `https://<domain>/robots.txt` allows crawling and lists
   `/sitemap.xml` and `/news-sitemap.xml`.
2. Fetch `/sitemap.xml`, `/news-sitemap.xml`, `/rss.xml` — verify valid XML and
   absolute URLs on the production domain.
3. Verify the domain in **Google Search Console** (use a real verification token
   — do not commit placeholder values) and submit `/sitemap.xml`.
4. Submit the publication in **Google Publisher Center** for News eligibility.
5. Populate `SiteSetting.general` (logo, socials as absolute URLs, contact
   email/phone if public) so Organization schema is complete. See `SEO.md`.
6. Replace `/public/images/logo.svg` and the sample media placeholder with real
   brand assets / Storage-backed images.

## Database

- Run `prisma migrate deploy` on the production database (never `migrate reset`).
- Migrations are additive and must not be edited/removed once shipped.
- `vercel-build` runs `prisma migrate deploy && next build` — migrations apply
  automatically on deploy, **but the seed does not**. Seeding is a controlled,
  manual operation: run `npm run db:seed` yourself (with `NODE_ENV=production`
  and `INITIAL_ADMIN_*` set) after the first deploy or when the base data set
  changes. This keeps deploys independent of admin credentials in the build
  environment and avoids rewriting role/permission rows on every deploy.

## Caching

- XML feeds/sitemaps set `Cache-Control` with `s-maxage` + `stale-while-revalidate`
  (news sitemap uses a short 10-min window for freshness).
- Pages are server-rendered (a per-request CSP nonce prevents full static
  generation); data reads use `React.cache` for per-request de-duplication.

## Database security — Row Level Security (RLS)

Supabase exposes the `public` schema through PostgREST / the anon key. This app
accesses the database **only server-side via Prisma** (the `postgres`
owner/service role) — it never uses a browser Supabase client or the anon key
for data (Supabase is used only for Storage, server-side, with the service-role
key). To resolve the Supabase **"RLS disabled in public"** security advisor,
migration `20260715000000_enable_rls_public_tables` enables RLS on all
Prisma-managed public tables with **no policies (deny-by-default)**:

- The table owner (`postgres`, used by Prisma) **bypasses RLS**, so the app is
  unaffected — verified by the full green test suite.
- Any PostgREST/anon access to these tables returns **zero rows**, locking down
  the Data API surface.

**Prerequisite:** the app must connect as `postgres` (or a `BYPASSRLS`/owner
role), which is the documented default in `.env.example`. If you point the app
at a restricted, non-owner role, add explicit policies before relying on RLS.
Run `get_advisors` in an authorized Supabase session after deploy to confirm the
advisor is cleared. Auth-side advisors (leaked-password protection, MFA) are
dashboard settings, not code.

## Vercel deployment (step by step)

The repo is Vercel-ready (Next.js auto-detected; `postinstall: prisma generate`
ensures a fresh Prisma Client on every build). To go live:

1. **Connect the repo**: Vercel → *Add New Project* → import
   `tavakolistudio/turkiye-farsi`. Framework: Next.js (auto). Production branch:
   `main` (auto-deploy on push).
2. **Set Environment Variables** (Production scope) — see the table below.
3. **Deploy**. Vercel runs `npm install` (→ `postinstall: prisma generate`) then
   the `vercel-build` script: **`prisma migrate deploy && tsx prisma/seed.ts &&
   next build`**. So migrations (including `20260715000000_enable_rls_public_tables`)
   and idempotent base-data provisioning (roles, permissions, super-admin from
   `INITIAL_ADMIN_*`, categories, static pages, settings — demo content is skipped
   in production) run automatically on every deploy. `DATABASE_URL`/`DIRECT_URL`
   must be set in the Production scope for this to succeed.
4. *(Optional, manual)* You can still run `npx prisma migrate deploy` yourself
   from a trusted machine with the production connection strings if you prefer
   not to migrate during the build.
5. **Verify RLS**: in an authorized Supabase session, run `get_advisors` and
   confirm the "RLS disabled in public" advisor is cleared. Ensure the app's DB
   role is `postgres`/owner (bypasses RLS) — the pooled Supabase connection uses
   this by default.
6. **Post-deploy smoke** (on the real domain): `/`, an article, `/admin/login`,
   `/robots.txt` (must now allow crawling), `/sitemap.xml`, `/news-sitemap.xml`,
   `/rss.xml`.

### Required Vercel environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | Supabase **pooled** connection string. |
| `DIRECT_URL` | ✅ | Supabase **direct** connection (for `migrate deploy`). |
| `NEXT_PUBLIC_SITE_URL` | ✅ | **Real production origin** (e.g. `https://turkiyefarsi.com`). Drives every canonical/OG/sitemap/feed URL and enables `robots.txt` crawling. |
| `NEXT_PUBLIC_SITE_NAME` | ✅ | e.g. `ترکیه فارسی`. |
| `INITIAL_ADMIN_EMAIL` | ✅ | Seed super-admin (first deploy only). |
| `INITIAL_ADMIN_PASSWORD` | ✅ | Strong secret. |
| `INITIAL_ADMIN_NAME` | ➖ | Defaults to `مدیر ارشد`. |
| `NEXT_PUBLIC_SUPABASE_URL` | ➖ | Only if using Supabase Storage. |
| `SUPABASE_SERVICE_ROLE_KEY` | ➖ | Storage uploads (server-side). Secret. |
| `SUPABASE_STORAGE_BUCKET` | ➖ | Defaults to `media`. |
| `CRON_SECRET` | ✅* | Required for the scheduled-publish cron endpoint. Secret. |
| `RESEND_API_KEY`, `EMAIL_FROM` | ➖ | Email (newsletter/transactional). |
| `SENTRY_DSN`, `NEXT_PUBLIC_GA_ID` | ➖ | Observability/analytics. |

`VERCEL_ENV` is set automatically by Vercel and gates indexability (only
`production` is crawlable).
