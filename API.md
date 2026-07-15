# API (v1)

Versioned REST API. Two surfaces:
- **Admin** `/api/v1/admin/*` — requires an authenticated session; each endpoint
  enforces a specific permission server-side.
- **Public** `/api/v1/public/*` — no auth, rate-limited, returns only PUBLISHED
  content with public-safe fields (headless consumption: website, mobile, bots, agents).

## Response envelope

Success:
```json
{ "success": true, "data": {}, "error": null, "meta": { "page": 1, "pageSize": 20, "total": 42, "totalPages": 3 } }
```
Error:
```json
{ "success": false, "data": null, "error": { "code": "NOT_FOUND", "message": "…" }, "meta": {} }
```

### Error codes
`VALIDATION_ERROR` (422), `UNAUTHENTICATED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404),
`CONFLICT` / `SLUG_TAKEN` / `IN_USE` / `CIRCULAR_REFERENCE` (409), `RATE_LIMITED` (429),
`PAYLOAD_TOO_LARGE` (413), `UNSUPPORTED_MEDIA_TYPE` (415), `BAD_REQUEST` (400), `INTERNAL` (500).

## List query params
`page`, `pageSize` (≤100), `search`, `sort` (whitelisted per resource), `order`
(`asc`/`desc`), `includeDeleted` (admin only). Article list also: `status`,
`authorId`, `categoryId`. Media list also: `type` (image/video/audio/application), `folderId`.

## Admin endpoints (permission)

| Method & path | Permission |
|---|---|
| `GET /api/v1/admin/articles` · `POST` | `article.view` · `article.create` |
| `GET/PATCH/DELETE /api/v1/admin/articles/{id}` | view / update.(own\|any) / delete |
| `POST /api/v1/admin/articles/{id}/restore` | `article.restore` |
| `GET/POST /api/v1/admin/categories` | `category.view` / `category.create` |
| `GET/PATCH/DELETE /api/v1/admin/categories/{id}` (`?reassignTo=`) | view/update/delete |
| `POST …/categories/{id}/restore` | `category.restore` |
| `GET/POST /api/v1/admin/tags`, `PATCH/DELETE /{id}`, `POST /{id}/restore` | tag.* |
| `POST /api/v1/admin/tags/merge` `{sourceTagId,targetTagId}` | `tag.merge` |
| `GET/POST /api/v1/admin/sources`, `PATCH/DELETE /{id}`, `/{id}/restore` | source.* |
| `POST /api/v1/admin/sources/{id}/verify` | `source.verify` |
| `GET /api/v1/admin/media` · `POST` (multipart `file`) | `media.view` · `media.upload` |
| `GET/PATCH/DELETE /api/v1/admin/media/{id}` | view / update / delete |
| `POST …/media/{id}/replace` (multipart) · `…/restore` | `media.replace` · `media.restore` |

## Public (headless) endpoints — rate-limited, PUBLISHED only

| Path | Returns |
|---|---|
| `GET /api/v1/public/articles` | list of published articles |
| `GET /api/v1/public/articles/{slug}` | one article by slug |
| `GET /api/v1/public/articles/{slug}/related` | related published articles |
| `GET /api/v1/public/categories` | active categories (with published counts) |
| `GET /api/v1/public/categories/{slug}/articles` | published articles in a category |
| `GET /api/v1/public/tags` | tags |
| `GET /api/v1/public/tags/{slug}/articles` | published articles for a tag |

Public payloads exclude internal/editorial/scheduling fields
(`factCheckStatus`, `scheduledAt`, `status`, view internals, etc.).

## Security
- Admin mutating **Server Actions** additionally verify `Origin`/`Host` (CSRF).
- Public endpoints use a per-IP fixed-window rate limiter.
- Uploads: MIME allowlist, 25 MB cap, safe/unique filenames, SVG & executables rejected.

## SEO feeds & discovery routes (Phase 7)

Public, cache-friendly XML/text endpoints (no auth, published-only):

| route | description |
| --- | --- |
| `GET /robots.txt` | Dynamic robots (production crawlable; preview/dev disallowed). |
| `GET /sitemap.xml` | Sitemap index referencing the child sitemaps + news sitemap. |
| `GET /sitemaps/{pages,categories,tags,authors,articles}.xml` | Per-type sitemaps. `articles.xml?p=N` for chunks. |
| `GET /news-sitemap.xml` | Google News sitemap — last-48h published articles. |
| `GET /rss.xml`, `/rss/latest.xml`, `/rss/breaking.xml`, `/rss/category/{slug}.xml` | RSS 2.0 feeds. |

All emit absolute URLs from `NEXT_PUBLIC_SITE_URL`, exclude draft/scheduled/
deleted content, and never expose internal/editorial fields.
