# Supabase Production — Deployment, Environment & Operations

This document describes how the **Turkey Farsi (ترکیه فارسی)** app connects to its
Supabase production project, the environment variables it needs, and the backup /
rollback / health-check procedures. **No secret values appear in this file** — only
variable names and non-sensitive configuration.

## Architecture summary

- **Database access:** exclusively via **Prisma** on the server, connecting as the
  `postgres` role through the Supabase connection pooler. The app does **not** read
  or write tables through Supabase client libraries or the PostgREST (`anon` key) API.
- **Authentication:** **custom, Prisma-based** (server sessions with SHA-256 hashed
  tokens in `sessions`, bcrypt/scrypt password hashes). Supabase Auth is **not** used.
  The `User.authId` column is reserved for a future optional Supabase-Auth provider.
- **Storage:** Supabase Storage via `SupabaseStorageAdapter` (server-only, uses the
  service-role key). Bucket: `turkiye-farsi-media` (public read; writes server-only).
- **Row Level Security:** enabled (deny-all, no policies) on every `public` table so
  the public PostgREST endpoint is closed. Prisma (`postgres`) bypasses RLS. See
  migration `20260715000000_enable_rls`.

## Connection strings (Prisma)

- `DATABASE_URL` → **Transaction pooler**, port `6543`, with
  `?pgbouncer=true&connection_limit=1&sslmode=require`. Used by the app at runtime
  (serverless-safe: pgbouncer + small connection limit avoids connection exhaustion
  on the free/nano plan).
- `DIRECT_URL` → **Session pooler**, port `5432`, with `?sslmode=require`. Used only
  by `prisma migrate deploy` (migrations need a non-pooled/session connection).

Both use the pooler host `aws-0-<region>.pooler.supabase.com` and the username
`postgres.<project-ref>`.

## Environment variables

Set real values only in `.env.local` (git-ignored) locally, or in the Vercel
dashboard. Never commit secrets. `.env*` is git-ignored except `.env.example`.

| Variable | Scope (Vercel) | Public? | Notes |
|---|---|---|---|
| `DATABASE_URL` | Production, Preview | server | Transaction pooler (6543) + pgbouncer |
| `DIRECT_URL` | Production, Preview | server | Session pooler (5432); migrations |
| `NEXT_PUBLIC_SUPABASE_URL` | Prod, Preview, Dev | **public** | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Prod, Preview, Dev | **public** | Anon key (safe in browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | Production, Preview | **secret** | Server-only. NEVER prefix with `NEXT_PUBLIC_` |
| `SUPABASE_STORAGE_BUCKET` | Prod, Preview, Dev | server | `turkiye-farsi-media` |
| `NEXT_PUBLIC_SITE_URL` | per-env | **public** | Prod = real domain; Preview = preview URL |
| `NEXT_PUBLIC_SITE_NAME` | Prod, Preview, Dev | **public** | Site name |
| `INITIAL_ADMIN_EMAIL` | (seed only) | server | Read by seed to create the super admin |
| `INITIAL_ADMIN_PASSWORD` | (seed only) | secret | Read by seed; never logged |
| `INITIAL_ADMIN_NAME` | (seed only) | server | Optional |
| `CRON_SECRET` | Production, Preview | **secret** | Authorizes scheduled-publish cron |
| `WEBHOOK_SECRET` | Production, Preview | **secret** | Authorizes inbound webhooks |
| `RESEND_API_KEY` | Production, Preview | secret | Optional (email) |
| `EMAIL_FROM` | Prod, Preview, Dev | server | Optional |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | per-env | mixed | Optional (observability) |
| `NEXT_PUBLIC_GA_ID` | Prod, Preview, Dev | public | Optional (analytics) |

> The `INITIAL_ADMIN_*` variables are only needed when running the seed. They do not
> need to be present in the running Vercel app after the admin exists, but it is
> harmless to keep them (the seed is idempotent).

### Vercel notes

- Add server secrets (`DATABASE_URL`, `DIRECT_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
  `CRON_SECRET`, `WEBHOOK_SECRET`) to **Production** and **Preview** only — not needed
  in the Vercel-hosted "Development" scope. Local dev uses `.env` / `.env.local`.
- `prisma generate` must run on build. Ensure the build command runs migrations if
  desired: `prisma migrate deploy && next build` (or run `migrate deploy` manually).
- Scheduled publishing: configure a Vercel Cron (or external scheduler) to hit the
  publish endpoint with the `CRON_SECRET`.

## Migrations

- Apply with `npx prisma migrate deploy` (production-safe; never `migrate dev`,
  `db push`, or `migrate reset` against production).
- Applied migrations:
  - `20260714134540_init_editorial` — full editorial schema
  - `20260715000000_enable_rls` — enable RLS (deny-all) on all public tables

## Seeding

- Production seed: `NODE_ENV=production npx prisma db seed`.
- Idempotent (upserts). Production mode creates only: roles, permissions, categories,
  home sections, site settings + static pages, and the super admin (from
  `INITIAL_ADMIN_*`). **No demo articles/users/ads** are created in production.

## Backup strategy

- **Automatic:** Supabase takes daily backups (retention depends on plan; free/nano =
  limited/PITR not included). Verify under Dashboard → Database → Backups.
- **Before any future migration:** take a manual snapshot first —
  `pg_dump "$DIRECT_URL" -Fc -f backup_YYYYMMDD.dump` (uses the session pooler / direct
  connection). Store the dump securely off-Supabase.
- **On-demand logical export of critical tables** can also be scripted via `pg_dump`
  with `--table` filters (e.g. `articles`, `users`, `site_settings`).

## Rollback

1. **Migration rollback:** Prisma migrations are forward-only. To revert, write a new
   *down* migration (a new `migrate deploy`) — do **not** edit or delete applied
   migrations.
2. **Data restore:** restore the latest `pg_dump` with `pg_restore` into the direct
   connection, or use Supabase's dashboard restore / PITR (if the plan supports it).
3. Always take a fresh backup **before** attempting a restore.

## Health check

- Quick DB check: `npx prisma migrate status` (expects "Database schema is up to date!").
- App-level: a lightweight endpoint can run `SELECT 1` via Prisma. Keep such checks
  cheap and ensure they do not leak connections.

## Connection exhaustion (free/nano plan)

- The app uses a **Prisma client singleton** (`src/lib/db.ts`) so hot-reload / repeated
  imports do not open new pools.
- Runtime uses the **transaction pooler** with `connection_limit=1` — appropriate for
  serverless functions.
- E2E and cron jobs must not leave connections open; ensure `prisma.$disconnect()` in
  one-off scripts (the seed already does this).

## Testing against production — DO NOT

- Integration tests and E2E (`npm run test` incl. `tests/integration`, `npm run
  test:e2e`) connect to `DATABASE_URL` and **write data**. They must run against an
  **isolated/local** database (the embedded Postgres via `npm run db:start`), never the
  production Supabase project. Point `DATABASE_URL`/`DIRECT_URL` at the local DB when
  running them.
