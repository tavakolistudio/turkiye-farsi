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

## Newsroom outbound fetch (SSRF)

- Every feed URL is validated by `src/server/newsroom/security/url-guard.ts`
  before any request: http/https only, no embedded credentials, and DNS is
  resolved and checked against a public-IP allowlist (rejects loopback,
  private, link-local, CGNAT and cloud metadata ranges) **before** connecting.
  Redirects are followed manually (never automatically) and **re-validated on
  every hop** — a redirect to a private address is rejected exactly like a
  direct request to one. A hard redirect-count cap, a streamed response-size
  cap, and a fetch timeout are enforced (`src/server/newsroom/fetch/safe-fetch.ts`).
  Sources are never fetched without an explicit human review of that Source's
  Terms/robots.txt (`termsReviewedAt`/`robotsReviewedAt`) — see
  `NEWSROOM_SOURCES_POLICY.md`. Arbitrary attacker-supplied URLs are never
  fetched: only URLs on approved, admin-managed `Source` rows are ever passed
  to the fetch layer.
- **Known residual risk — DNS rebinding TOCTOU:** `assertSafeUrl` resolves and
  validates DNS itself, but the subsequent `fetch()` call lets Node's
  runtime (undici) re-resolve the hostname independently rather than
  connecting to the exact address we validated. A DNS server that returns a
  different IP on each successive query (TTL=0) could theoretically flip from
  a public to a private address in the narrow window between our check and
  undici's own connect-time resolution. Closing this completely requires
  pinning the socket to the validated IP — via a custom `undici` `Agent` with
  a `connect.lookup` override (a new dependency and a nontrivial low-level
  change), or rewriting the fetch loop onto `node:http`/`node:https` with a
  custom `lookup` agent option (no new dependency, but a substantial rewrite
  of a currently-tested code path). Both were judged too risky to ship
  unverified against a guard that is otherwise working and covered by tests
  (`tests/unit/newsroom-security.test.ts`, `tests/unit/safe-fetch.test.ts`).
  Accepted because: sources are pre-approved admin-managed rows, not arbitrary
  URLs, and the window is a handful of lines of synchronous code (no
  intervening network I/O), making the race impractical to win reliably even
  against a hostile authoritative resolver. Tracked as a follow-up, not a
  blocker.

## Newsroom AI enrichment

- AI (OpenAI) is used **only** to draft the Persian article body/summary/title
  when `aiEnabled` is on, the item clears `minScoreForAI`, and the daily
  `dailyAiBudget` guard has room — never for importance scoring,
  classification or trust evaluation, which remain deterministic/rule-based
  (the final DRAFT/publish decision is always rule-based + human editor).
  Any AI failure, disabled state, or exhausted budget silently falls back to
  the rule-based draft; the pipeline never throws or blocks on an AI error.
- All AI output is parsed through Zod schemas (`src/server/newsroom/ai/schemas.ts`)
  before use — an untrusted/malformed response can never reach the database.
  Source text handed to the model is bounded (title + short excerpt only,
  never full article bodies) and passed through prompt-injection neutralization
  (`src/server/newsroom/security/prompt-safety.ts`, tested in
  `tests/unit/newsroom-security.test.ts`).
- `OPENAI_API_KEY` is read only in `src/server/newsroom/ai/provider.ts`, which
  is reachable solely through `newsroom.service.ts` (marked `import
  "server-only"`) — never through a client component, and never
  `NEXT_PUBLIC_`-prefixed, so it cannot reach the browser bundle.

## Indexability

- `robots.txt` is dynamic: only a production Vercel deployment is crawlable;
  preview/development return `Disallow: /`. Admin and thin/search pages are
  `noindex`.
