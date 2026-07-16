# Security

Security posture and reporting for Turkey Farsi (ترکیه فارسی). No secret values
appear in this repository or its docs.

## Reporting a vulnerability

Report privately to the maintainers (do not open a public issue for an unpatched
vulnerability). Include reproduction steps and impact. Do not include live
secrets in the report.

## Secrets

- All secrets live in environment variables only: locally in git-ignored
  `.env`, in production in the Vercel project settings. `.gitignore` excludes
  `.env*` (except `.env.example`, which holds placeholders only).
- `SUPABASE_SERVICE_ROLE_KEY` is **server-only** — referenced solely in
  `src/server/storage/*`, never prefixed `NEXT_PUBLIC_`, and verified absent from
  the built client bundle.
- Rotation procedure: see **Secret rotation** in `DEPLOYMENT.md`. Rotate on a
  schedule and immediately on any suspected exposure.

## Authentication & authorization

- Custom, server-side auth on Prisma: DB-backed sessions with SHA-256-hashed
  tokens in `__Host-`-prefixed, HttpOnly, Secure, SameSite cookies; passwords
  hashed with scrypt (`src/server/auth/password.ts`). Supabase Auth is **not**
  used for login — do not add a parallel auth system.
- Login is rate-limited (5 failures / 15 min per email+IP) and audited.
- Every admin page and Server Action performs a server-side permission check
  (RBAC in `src/server/rbac/*`); UI hiding is never the only gate.

## Data exposure

- The public site and public API return **published articles only**; drafts,
  scheduled/unpublished content, preview tokens, audit logs, editorial comments
  and user PII are never exposed publicly (covered by e2e tests).
- **RLS**: every table in the `public` schema has Row Level Security enabled with
  **no policies (deny-by-default)**. The app connects via Prisma as the
  `postgres` owner role, which bypasses RLS; Supabase's PostgREST/anon-key Data
  API therefore returns zero rows. Keep the app on an owner/`BYPASSRLS` role. See
  `DEPLOYMENT.md` → “Database security”.

## Machine-to-machine endpoints

- The scheduled-publish cron (`/api/cron/publish`) and webhooks authenticate with
  a constant-time `Authorization: Bearer <secret>` check and **fail closed** when
  the secret is unset (`src/server/security/cron.ts`). Secrets are never placed
  in URLs, query strings, or `vercel.json`.

## Transport & headers

- A per-request nonce-based Content-Security-Policy plus HSTS (production),
  `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` and
  frame-ancestors are applied to all routes via `src/proxy.ts`.
- Mutating Server Actions enforce same-origin (CSRF) checks.

## Uploads

- Server-side only, permission-gated, with a strict MIME allowlist, size cap,
  and path-traversal guards (`src/server/storage/*`). SVG/executable types are
  rejected by omission.

## Indexability

- `robots.txt` is dynamic: only a production Vercel deployment is crawlable;
  preview/development return `Disallow: /`. Admin and thin/search pages are
  `noindex`.
