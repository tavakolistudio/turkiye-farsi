# AI Newsroom (Phase 10A)

A privacy- and copyright-conscious ingestion pipeline that periodically checks
**approved** news sources, collects new items, de-duplicates and clusters them,
scores their importance for the *Iranians-in-Turkey* audience, evaluates trust,
and prepares an editorial **DRAFT** for suitable stories.

> **Nothing is ever auto-published.** Every output lands in the review queue as a
> private `DRAFT` Article. No AI images, no social auto-posting, no scraping of
> disallowed sources, no full copyrighted text is stored.

## Pipeline

```
Source Registry → Feed Fetcher → Normalizer → Content Safety
→ Duplicate Detector → Story Cluster → Importance Scorer → Trust Evaluator
→ (optional AI) → Persian Draft (editor-triggered) → Review Queue
```

Each stage is an independent, typed, testable service under
`src/server/newsroom/`. A failure in one item never aborts the batch; every
stage writes a secret-free `NewsPipelineJobLog`.

| Stage | Module |
|---|---|
| Safe fetch (SSRF-hardened) | `fetch/safe-fetch.ts`, `security/url-guard.ts` |
| Feed parsing (RSS/Atom/JSON, XXE-safe) | `fetch/parse-feed.ts`, `fetch/xml.ts` |
| Normalization (Persian, hashes, canonical URL) | `normalize/*` |
| Duplicate detection (5 levels) | `dedup/*` |
| Story clustering | `cluster/cluster.service.ts` |
| Importance scoring (rule-based, explainable) | `scoring/importance.service.ts` |
| Trust evaluation | `scoring/trust.service.ts` |
| Classification (existing taxonomy only) | `classify/classification.service.ts` |
| AI provider abstraction | `ai/*` |
| Persian draft builder | `draft/persian-draft.service.ts` |
| Orchestrator | `pipeline.service.ts` |
| Admin operations | `newsroom.service.ts` |

## Duplicate detection (layered)

1. exact canonical URL · 2. `(sourceId, externalId)` · 3. normalized title hash ·
4. fuzzy title similarity (Jaccard + Levenshtein) · 5. semantic embeddings
*(extension point, disabled until an embedding provider is configured)*.

Exact duplicates (1–3) are skipped. Fuzzy matches (4) from a **different** source
are kept and grouped into the same **story cluster** for multi-source
confirmation.

## Importance & trust

- **Importance** (0–100) is a weighted sum of 12 explainable components; weights
  are admin-configurable (`NewsroomSettings.scoringWeights`). Rule score and AI
  score are stored **separately**; the rule score always stands alone so the
  pipeline survives AI failure. Buckets: `0–39 reject · 40–59 low · 60–74 review
  · 75–89 high · 90–100 urgent`.
- **Trust** measures how well-sourced a story is. Social-only stories cap at
  `SINGLE_SOURCE`; legal/immigration claims without an official source are flagged
  `requiresHumanFactCheck`. **Even a score of 100 is never auto-published.**

## AI provider abstraction

`AIEditorialProvider` (`ai/provider.ts`) with three implementations:

- **DisabledAIProvider** — default; used when `OPENAI_API_KEY` is missing or
  `aiEnabled=false`. Every call throws and the pipeline falls back to rules.
- **MockAIProvider** — deterministic, for tests.
- **OpenAIProvider** — JSON response format, **randomized prompt-injection
  boundary**, **Zod-validated output**, token/cost accounting. Raw prompt and
  completion are never logged.

Env: `OPENAI_API_KEY`, `OPENAI_NEWSROOM_MODEL`, `OPENAI_NEWSROOM_TIMEOUT_MS`,
`OPENAI_NEWSROOM_MAX_TOKENS`. A daily budget (`dailyAiBudget`) is enforced by
`budget.ts` and rolls up spend from both collection batches and draft
generation cost recorded on `NewsDraftProvenance`.

### Rule-based vs AI responsibilities (important)

AI is used for **exactly one thing**: drafting the Persian title/summary/body
text (`generatePersianDraft`), and only when `aiEnabled` is on, the item's
score clears `minScoreForAI`, and the daily budget guard has room. It is
called from `createDraftFromItem` and `regenerateDraft`
(`newsroom.service.ts`) with the rule-based `buildDraft` output as a baseline
that AI fields are merged over; on any AI error, missing budget, or AI being
disabled, the rule-based draft is used unchanged — the pipeline never throws
on an AI failure. **Importance scoring, classification and trust evaluation
are always rule-based** — AI is never consulted for those, and never for the
final publish decision. The final decision to actually publish an article is
always a **human editor**, acting outside this pipeline entirely; this
pipeline only ever produces a private `DRAFT`.

## Settings / kill switches (all real)

`NewsroomSettings` (SiteSetting key `newsroom`) — `isEnabled`, `aiEnabled`,
`collectionEnabled`, `draftGenerationEnabled`, `maxSourcesPerRun`,
`maxItemsPerSource`, `maxDraftsPerRun`, `minScoreForAI`, `minScoreForDraft`,
`dailyAiBudget`, `scoringWeights`, `fetchTimeout`, `retryCount`, `retentionDays`.
Collection and AI default to **OFF**.

## Admin surfaces

- `/admin/newsroom` — review queue (tabs by importance bucket + rejected/drafted),
  per-item **create draft / reject / reprocess / regenerate**, manual run, stats.
- `/admin/newsroom/settings` — all kill switches, run limits, scoring weights,
  reset-to-defaults, and the **retention cleanup** dry-run/run card.
- `/admin/newsroom/sources` — per-source feed URL/method/trust/priority, enable
  /disable, **Test Feed** (SSRF-hardened, no persistence), and last-fetch / ETag
  / Last-Modified / failure status.
- `/admin/newsroom/clusters` (+ `/[id]`) — multi-select **merge** and per-item
  **split**.
- `/admin/newsroom/runs` (+ `/[id]`) — recent collection-batch history and their
  per-stage `NewsPipelineJobLog` entries, gated by `newsroom.view_logs`.

## Reprocess & regenerate

- **Reprocess** re-runs classification/importance/trust for an item with the
  current settings — idempotent, never re-fetches, preserves DRAFTED.
- **Regenerate** rebuilds an item's draft. It refuses to clobber a human-edited
  or advanced draft unless forced, and always snapshots a revision first. Stays
  `DRAFT`.

## Cron & operations

- `GET/POST /api/cron/newsroom-dispatch` — the one newsroom job actually on
  Vercel's schedule (`vercel.json`, daily). Runs collection then retention
  cleanup, in that fixed order, in a single invocation. `CRON_SECRET`
  (Bearer, never query string; fails closed).
- **Why combined:** the Vercel Hobby plan caps the number of scheduled Cron
  Jobs, and this project already has `/api/cron/publish` (unrelated,
  pre-existing) registered — adding two more newsroom crons would exceed the
  cap. Collection and cleanup each already carry their own concurrency guard
  (batch `RUNNING` lock; Postgres advisory lock), so running them
  back-to-back in one request never double-processes or overlaps with an
  independently-triggered manual run.
- `GET/POST /api/cron/newsroom-collect` and `/api/cron/newsroom-cleanup` still
  exist individually (same `CRON_SECRET` protection) but are **not** on the
  automatic schedule anymore — kept for manual/ops triggering only.
- Batch lock: only one `RUNNING` batch at a time; idempotent via
  `unique(sourceId, externalId)`. Real conditional GET (stored ETag /
  If-Modified-Since per source).
- Manual run from the queue (permission `newsroom.run_collection`).

## Tests

199 unit/integration + 71 E2E (real browser) — all run against a local
embedded Postgres (`npm run db:start`), never production/Supabase.

## Permissions

`newsroom.view`, `.manage_sources`, `.run_collection`, `.review`, `.reject`,
`.create_draft`, `.regenerate`, `.manage_clusters`, `.manage_scoring`,
`.view_costs`, `.view_logs`. Editor-in-Chief gets all; Editor gets
view/review/create_draft/reject; Reporter/Author get view. Enforced server-side.

## Notifications

`NEWSROOM_URGENT`, `NEWSROOM_SOURCE_FAILING` and `NEWSROOM_PIPELINE_FAILURE`
fire on real pipeline events. `NEWSROOM_DRAFT_READY` fires when an editor
creates a draft. `NEWSROOM_BUDGET_WARNING` fires when the daily AI budget
blocks a would-be AI call, or crosses 90% of the cap.
`NEWSROOM_SOURCE_CONFLICT` is wired to `trust.verificationStatus ===
"CONFLICTING"` in both the pipeline and `reprocessItem` — but **no detector
sets that condition today**: comparing extracted claims across clustered
sources to detect actual disagreement isn't built. The notification path
itself is tested (with `evaluateTrust` mocked to force `CONFLICTING`), so it
will work correctly the moment a real detector is added; nothing was invented
to force a trigger that doesn't exist yet.

## Manual source approval policy

No source is ever polled without a human first reviewing and approving it in
`/admin/newsroom/sources` (setting `feedUrl`/`collectionMethod` and confirming
Terms/robots.txt review, tracked via `termsReviewedAt`/`robotsReviewedAt`) —
see [NEWSROOM_SOURCES_POLICY.md](./NEWSROOM_SOURCES_POLICY.md) for the
approval checklist. The pipeline never fetches an arbitrary URL; only
`feedUrl` values on approved, `isEnabled` `Source` rows are ever requested.

## No-auto-publish policy

Every code path that can produce or touch a `NewsDraftProvenance`
(`createDraftFromItem`, `regenerateDraft`) writes an `Article` with
`status: "DRAFT"` — hardcoded, not a variable, and never conditionally
changed. Nothing in `src/server/newsroom/` ever sets `PUBLISHED`,
`APPROVED`, or `SCHEDULED`; publishing an article is only ever performed by a
human editor through the ordinary editorial workflow
(`editorial-workflow.service.ts`), entirely outside this pipeline. Covered by
integration tests (drafts always DRAFT, never public) and e2e tests (draft
not public, no auto-publish across the full UI flow).

## Copyright

See [NEWSROOM_SOURCES_POLICY.md](./NEWSROOM_SOURCES_POLICY.md). Only title, short
excerpt, metadata and source URL are stored — never the full article body or raw
HTML. Drafts are editorial rewrites with preserved source attribution.
