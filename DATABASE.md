# Database

PostgreSQL 17 via Prisma. Runs on local embedded Postgres in development and
Supabase Postgres in production (connection strings come from env — nothing is
hardcoded). Schema: [`prisma/schema.prisma`](prisma/schema.prisma).

## Running locally

```bash
npm run db:start      # start local embedded Postgres (keep this running)
npm run db:migrate    # apply migrations (prisma migrate dev)
npm run db:seed       # seed roles, permissions, admin, categories, sample data
npm run db:studio     # optional: Prisma Studio
```

`DATABASE_URL` / `DIRECT_URL` point at the DB. In production set them to the
Supabase pooled + direct connection strings.

## Content models (Phase 4)

| Model | Purpose | Soft delete |
|-------|---------|-------------|
| `Article` | News/article content + editorial, SEO & social fields | ✅ `deletedAt` |
| `Category` | Hierarchical taxonomy (parent/child) | ✅ |
| `Tag` | Flat taxonomy, mergeable | ✅ |
| `Source` | Citations/outlets with credibility | ✅ |
| `Media` / `MediaFolder` | Uploaded assets + folders | ✅ |
| `ArticleCategory` | Article↔Category (primary/secondary + order) | — |
| `ArticleTag` | Article↔Tag | — |
| `ArticleSource` | Article↔Source (url, title, accessedAt, isPrimary, note) | — |
| `ArticleMedia` | Article↔Media (role, order, captionOverride) | — |

### Relations
- Article → `primaryCategory` (FK) + `categories[]` (join, secondary), `tags[]`,
  `sources[]`, `media[]`, `author` (User), `featuredImage` / `ogImage` (Media).
- Category → self `parent`/`children`, `image` (Media), `articles[]`, `primaryArticles[]`.
- Media → `folder`, `uploadedBy` (User), and back-relations for every place it is used.

### Enums
`ArticleStatus`, `ContentType` (SHORT_NEWS/NEWS/ARTICLE/ANALYSIS/GUIDE/NOTICE/VIDEO),
`FactCheckStatus`, `ArticleSourceStatus`, `SourceType`, `CredibilityLevel`, `MediaRole`.
The runtime arrays in [`src/lib/content-enums.ts`](src/lib/content-enums.ts) are
compile-checked against these Prisma enums (`satisfies`), keeping DB and TS in sync.

### Indexes (performance)
`article.slug`, `article.status`, `article.publishedAt`, `article.primaryCategoryId`,
`article.authorId`, `article.scheduledAt`, `category.slug`, `tag.slug`, `source.slug`,
`media.mimeType`, `media.folderId`, plus `deletedAt` indexes for soft-deleted models.
List queries use `_count` selects to avoid N+1.

## Soft delete
Important content is never hard-deleted: services set `deletedAt` and can
`restore` it. Deleting a category with attached articles is refused unless a
reassignment target is provided (articles are moved first). Media that is still
referenced anywhere cannot be deleted.

## Migrations
Migrations live in `prisma/migrations/`. Phase 2–4 were consolidated into a single
clean `init_content_core` migration while the project is pre-production. Apply with
`npm run db:migrate` (dev) or `npm run db:deploy` (prod).
