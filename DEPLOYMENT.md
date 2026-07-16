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
   the `vercel-build` script: **`prisma migrate deploy && next build`**. So
   migrations (including the RLS lockdown) apply automatically on every deploy,
   but **the seed does NOT run during the build** — seeding is a controlled
   manual step (see “Manual seed” below). `DATABASE_URL` and `DIRECT_URL` must be
   set in the Production scope or the build fails at `prisma migrate deploy`.
4. **Seed once, manually** (first deploy only, or when base data changes): run
   `npm run db:seed` with `NODE_ENV=production` and the production connection
   strings + `INITIAL_ADMIN_*` set in your shell. It is idempotent (safe to
   re-run) and provisions roles, permissions, the super-admin, categories,
   static pages and settings — demo content is skipped in production.
5. **Verify RLS**: in an authorized Supabase session, run `get_advisors` and
   confirm the "RLS disabled in public" advisor is cleared. Ensure the app's DB
   role is `postgres`/owner (bypasses RLS) — the pooled Supabase connection uses
   this by default.
6. **Post-deploy smoke** (on the real domain): `/`, an article, `/admin/login`,
   `/robots.txt` (must now allow crawling), `/sitemap.xml`, `/news-sitemap.xml`,
   `/rss.xml`.

## Scheduled publishing (Vercel Cron)

`vercel.json` registers one cron job:

```json
{ "crons": [{ "path": "/api/cron/publish", "schedule": "0 * * * *" }] }
```

- **Schedule**: hourly (`0 * * * *`). Chosen conservatively for the Hobby plan;
  raise the frequency only deliberately.
- **What it does**: `POST`/`GET /api/cron/publish` → `schedulingService.runDue()`
  publishes articles whose `scheduledAt` has passed. The claim is atomic
  (`updateMany` on `status = SCHEDULED`), so a re-run never double-publishes;
  each run writes a `PublishJobLog` row.
- **Auth**: the route calls `isValidCronRequest`, which requires
  `Authorization: Bearer <CRON_SECRET>` compared in constant time and **fails
  closed** when `CRON_SECRET` is unset. Vercel automatically attaches this header
  to cron invocations when `CRON_SECRET` is present in the project env. The
  secret is never placed in `vercel.json` or the URL.
- Vercel Cron calls the path with `GET`; the route also accepts `POST` for manual
  machine triggers. Both require the secret.

### Required Vercel environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | Supabase **pooled** connection string. |
| `DIRECT_URL` | ✅ | Supabase **direct** connection (for `migrate deploy`). |
| `NEXT_PUBLIC_SITE_URL` | ✅ | **Real production origin** (e.g. `https://turkiyefarsi.com`). Drives every canonical/OG/sitemap/feed URL and enables `robots.txt` crawling. |
| `NEXT_PUBLIC_SITE_NAME` | ✅ | e.g. `ترکیه فارسی`. |
| `INITIAL_ADMIN_EMAIL` | Seed only | Read by the **manual** seed, not the build. Set it in the shell you run `db:seed` from; not required for runtime. |
| `INITIAL_ADMIN_PASSWORD` | Seed only | Strong secret. Manual seed only. |
| `INITIAL_ADMIN_NAME` | ➖ | Defaults to `مدیر ارشد`. |
| `WEBHOOK_SECRET` | ✅ | Machine-to-machine webhook auth. Secret. |
| `NEXT_PUBLIC_SUPABASE_URL` | ➖ | Only if using Supabase Storage. |
| `SUPABASE_SERVICE_ROLE_KEY` | ➖ | Storage uploads (server-side). Secret. |
| `SUPABASE_STORAGE_BUCKET` | ➖ | Defaults to `media`. |
| `CRON_SECRET` | ✅* | Required for the scheduled-publish cron endpoint. Secret. |
| `RESEND_API_KEY`, `EMAIL_FROM` | ➖ | Email (newsletter/transactional). |
| `SENTRY_DSN`, `NEXT_PUBLIC_GA_ID` | ➖ | Observability/analytics. |

`VERCEL_ENV` is set automatically by Vercel and gates indexability (only
`production` is crawlable).

> Set these in **Vercel → Project → Settings → Environment Variables** (or
> `vercel env add <NAME> production`). Never commit them; `.env`/`.env.local`
> are git-ignored. A missing `DATABASE_URL`/`DIRECT_URL` fails the build at
> `prisma migrate deploy` (error `P1012: Environment variable not found`).

## Production smoke test (after a successful deploy)

Run against the real production origin:

- **Public**: `/` (200), header/footer, mobile nav, `/news`, `/latest`,
  `/breaking`, `/most-viewed`, `/search`, a static page, `/robots.txt`,
  `/sitemap.xml`, `/news-sitemap.xml`, `/rss.xml`.
- **Admin**: `/admin/login` → sign in as the seeded super-admin → dashboard;
  create + autosave a draft; create a category/tag; upload → view → delete media.
- **Isolation**: a draft/scheduled article must NOT appear on any public URL or
  in the public API; preview needs a valid token; the public API never returns
  admin/workflow fields.
- **Cron**: `GET /api/cron/publish` with no/blank secret → 401; with the correct
  `Authorization: Bearer <CRON_SECRET>` → 200 and a safe run (empty result when
  nothing is due); a second call is idempotent.

Delete any test data/media afterwards; keep audit logs.

## Rollback

- **Instant, no rebuild**: Vercel → Deployments → pick the last known-good
  READY production deployment → **Promote to Production** (or **Instant
  Rollback**). This only reverts application code/routing.
- **The database is not rolled back by a code rollback.** Prisma migrations are
  additive and forward-only — never `migrate reset`/`down` on production. If a
  migration must be undone, ship a new corrective migration.
- Take a Supabase backup (or PITR checkpoint) before any migration that changes
  or drops columns. See “Backups” in `docs/supabase-production.md`.

## Secret rotation

Rotate on a schedule and immediately if a value is ever exposed:

1. **DB password** — Supabase → Settings → Database → Reset. Update
   `DATABASE_URL` + `DIRECT_URL` in Vercel (all scopes) and your local `.env`,
   then redeploy.
2. **`SUPABASE_SERVICE_ROLE_KEY`** — Supabase → Settings → API → roll the secret
   key. Update Vercel + `.env`; redeploy. (Storage stops working until updated.)
3. **`CRON_SECRET` / `WEBHOOK_SECRET`** — regenerate (`openssl rand -hex 32`),
   update Vercel + `.env`; the cron picks up the new value on next deploy.
4. **Admin password** — change it from inside the admin panel (never by editing
   the DB); `INITIAL_ADMIN_PASSWORD` only affects a fresh manual seed.

Never print secret values in logs, PRs, or issues. Rotating never requires
committing a secret.

## Production incident checklist

1. **Triage**: Vercel → Deployments → check the latest production build/runtime
   logs (`get_deployment_build_logs`, runtime logs). Do not paste secrets.
2. **Fastest mitigation**: Instant Rollback to the last good deployment (above).
3. **DB health**: confirm Supabase project is ACTIVE_HEALTHY and connections are
   not exhausted (pooled `DATABASE_URL` + `connection_limit=1` for serverless).
4. **Auth/authz regressions**: verify admin login and that drafts stay private.
5. **Suspected secret exposure**: rotate the affected secret (above), then
   redeploy; review `audit_logs`.
6. **Migration failure mid-deploy**: the build fails before `next build`, so no
   new code serves; fix forward with a corrective migration — never `reset`.
7. Record the incident and follow-ups; keep audit logs intact.
