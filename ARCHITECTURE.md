# Architecture

Turkey Farsi (ترکیه فارسی) is a Next.js 16 (App Router, RSC) application designed
to also serve as a **headless editorial platform**. Business logic is separated
from the UI so the same services back the admin panel, the REST API, and future
consumers (mobile, bots, agents).

## Layers

```
UI (RSC pages + client forms)          src/app/**, src/components/**
  │  Server Actions (admin mutations)   src/app/admin/**/actions.ts
  │  Route Handlers (REST API v1)       src/app/api/v1/**
  ▼
Service Layer  (business logic)         src/server/services/*.service.ts
  · authorization (assertPermission)    · validation (Zod)  · audit logging
  ▼
Data Access Layer (DAL)                 src/server/data/*.repo.ts
  · pure Prisma queries, select/include, soft-delete filters
  ▼
Database (Prisma / PostgreSQL)          src/lib/db.ts, prisma/schema.prisma
```

Cross-cutting:
- **Storage adapter** — `src/server/storage/*` (Local dev adapter + Supabase adapter behind one interface).
- **RBAC** — `src/server/rbac/*` (permission keys, role→permission map, authz helpers).
- **Auth/session** — `src/server/auth/*` (DB-backed sessions, scrypt passwords).
- **API envelope** — `src/lib/api/*` (standard `{success,data,error,meta}`, error codes, pagination).
- **Security** — `src/proxy.ts` (CSP + headers + coarse admin gate), `src/server/security/*` (CSRF, cron).

## Key principles
- **No business logic in components or routes.** Pages/routes/actions call services.
- **Authorization is always server-side.** Every service method calls
  `assertPermission(ctx.actor, …)`; the UI only hides controls for convenience.
- **Services are provider-agnostic and testable.** They take a `ServiceContext`
  (`{actor, ip, userAgent}`) instead of reaching into `next/headers`, so they run
  in unit/integration tests without a request.
- **Mass-assignment safe.** Zod schemas whitelist accepted fields; services map
  only those to Prisma.
- **Public vs admin separation.** Public read API returns only PUBLISHED content
  through `publicArticleSelect`, never leaking internal/editorial fields.

## Request flows
- **Admin form** → Server Action → `assertSameOrigin()` → `getServiceContext()` →
  `xService.method()` → revalidate/redirect.
- **REST admin** → `getActorContext()` (session→ctx) → service → `ok()/failFrom()`.
- **REST public** → `enforcePublicRateLimit()` → `publicContentService` → `ok()`.

## Storage adapter
`getStorageAdapter()` returns the Supabase adapter when `NEXT_PUBLIC_SUPABASE_URL`
+ `SUPABASE_SERVICE_ROLE_KEY` are set, else the local adapter (writes to
`public/uploads`, dev only). Both implement `StorageAdapter { save, delete }`.
Uploads are validated (MIME allowlist, size cap, safe filename, path-traversal
guard) before any bytes are written.
