# Newsroom Sources Policy

Rules for collecting from external sources. These are enforced in code and are
binding on every contributor and automated process.

## What we may collect

- Only from sources **explicitly approved** in the Source Registry and marked
  `isEnabled = true`, via a machine-readable endpoint we are allowed to poll:
  **RSS, Atom, JSON Feed, or an official API**. `MANUAL` entry is always allowed.
- General web-page scraping (`WEB_PAGE_ALLOWED`) is **disabled by default** and
  must never be turned on for a source whose Terms or `robots.txt` disallow it.
- A human must record `termsReviewedAt` / `robotsReviewedAt` before enabling
  automated collection for a source.

## What we store (copyright-safe)

- **Allowed:** title, a **short excerpt** (length-limited per source via
  `maxExcerptLength`, HTML stripped), publication metadata, author name, and the
  **source URL**.
- **Never stored:** the full article body, raw HTML, images copied from the
  source, or any paywalled/login-gated content.
- `allowFullTextFetch` stays `false` unless a source's licence explicitly permits
  storing more than a short excerpt.

## What we must never do

- Bypass a paywall or a login wall.
- Scrape a source against its Terms or `robots.txt`.
- Use a source's images as our featured/OG image without permission, or hotlink
  an external image URL as a featured image.
- Republish copyrighted text. Drafts are **editorial rewrites**; direct quotes
  are short, attributed and limited.
- Auto-publish, auto-post to social, or auto-generate AI images (out of scope for
  this phase).

## Attribution

- The source name and URL are **always preserved** and attached to any draft
  (`ArticleSource`), and rendered in the draft body's «منابع» block.
- When sources conflict, the item is marked `CONFLICTING` and held for human
  review; breaking-but-unverified items keep a «در حال بررسی» note.

## Legal / immigration content

Claims about residence, immigration, citizenship, fines or deportation without an
**official** source are flagged `requiresHumanFactCheck` and carry a disclaimer.
The AI never asserts a fact-check is complete without sufficient evidence.

## Admin warnings

Sources with legal restrictions should carry a note in the registry, and drafts
derived from single-source or social-only stories surface a trust warning in the
review queue.
