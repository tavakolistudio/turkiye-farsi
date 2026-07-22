<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Newsroom — permanent rules (Phase 10A)

These are binding for all future work on the AI newsroom. See
[AI_NEWSROOM.md](./AI_NEWSROOM.md) and
[NEWSROOM_SOURCES_POLICY.md](./NEWSROOM_SOURCES_POLICY.md).

- **No auto-publish.** Newsroom output is always a private `DRAFT` Article. Auto
  publishing requires a separate, explicitly-approved phase.
- **Never reset the production database.** No `prisma migrate reset` / seed reset
  against production. Migrations are additive and run with `prisma migrate deploy`.
- **No full copyrighted article storage.** Store only title, short excerpt,
  metadata and source URL — never the full body or raw HTML.
- **Source attribution is mandatory.** Preserve source name + URL on every item
  and draft.
- **AI output always needs validation.** Parse every AI response through its Zod
  schema before use; the pipeline must keep working (rule-based) if AI fails.
- **Draft status is mandatory** — never create an Article as `PUBLISHED`,
  `APPROVED` or `SCHEDULED` from the pipeline.
- **No secrets in logs.** Never log API keys, connection strings, raw prompts or
  full source responses. Use `NewsPipelineJobLog` with redacted messages.
- **No scraping without explicit source approval.** Only poll approved sources
  via RSS/Atom/JSON/official API. Honour Terms and `robots.txt`; never bypass a
  paywall/login. SSRF guards (public-IP-only, no private ranges) must stay on.
