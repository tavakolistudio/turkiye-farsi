# Changelog

All notable changes to Turkey Farsi (ترکیه فارسی). Phased delivery.

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
