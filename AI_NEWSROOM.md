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
`budget.ts`.

## Settings / kill switches (all real)

`NewsroomSettings` (SiteSetting key `newsroom`) — `isEnabled`, `aiEnabled`,
`collectionEnabled`, `draftGenerationEnabled`, `maxSourcesPerRun`,
`maxItemsPerSource`, `maxDraftsPerRun`, `minScoreForAI`, `minScoreForDraft`,
`dailyAiBudget`, `scoringWeights`, `fetchTimeout`, `retryCount`, `retentionDays`.
Collection and AI default to **OFF**.

## Cron & operations

- `GET/POST /api/cron/newsroom-collect` — authenticated by `CRON_SECRET` (Bearer,
  never query string; fails closed). Daily on Vercel Hobby (`vercel.json`).
- Batch lock: only one `RUNNING` batch at a time; idempotent via
  `unique(sourceId, externalId)`.
- Manual run: **اتاق خبر هوشمند** in the admin (`/admin/newsroom`) →
  «اجرای جمع‌آوری» (permission `newsroom.run_collection`).

## Permissions

`newsroom.view`, `.manage_sources`, `.run_collection`, `.review`, `.reject`,
`.create_draft`, `.regenerate`, `.manage_clusters`, `.manage_scoring`,
`.view_costs`, `.view_logs`. Editor-in-Chief gets all; Editor gets
view/review/create_draft/reject; Reporter/Author get view. Enforced server-side.

## Copyright

See [NEWSROOM_SOURCES_POLICY.md](./NEWSROOM_SOURCES_POLICY.md). Only title, short
excerpt, metadata and source URL are stored — never the full article body or raw
HTML. Drafts are editorial rewrites with preserved source attribution.
