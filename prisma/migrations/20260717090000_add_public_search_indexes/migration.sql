-- Built-in PostgreSQL full-text index for fast public news search. The
-- application still keeps a safe ILIKE fallback for partial Persian terms.
CREATE INDEX IF NOT EXISTS "articles_public_search_fts_idx"
ON "articles"
USING GIN (
  to_tsvector(
    'simple',
    coalesce("title", '') || ' ' || coalesce("subtitle", '') || ' ' ||
    coalesce("summary", '') || ' ' || coalesce("bodyJson"::text, '')
  )
)
WHERE "status" = 'PUBLISHED' AND "deletedAt" IS NULL;

CREATE INDEX IF NOT EXISTS "articles_public_search_date_idx"
ON "articles" ("publishedAt" DESC, "authorId", "primaryCategoryId")
WHERE "status" = 'PUBLISHED' AND "deletedAt" IS NULL;
