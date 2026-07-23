# Admin Guide (پنل مدیریت)

The admin panel lives at `/admin` and is fully Persian/RTL. Access requires a
signed-in user; each section and action checks the user's permissions on the server.

## Sign in
- Go to `/admin` → you're redirected to `/admin/login`.
- The initial super admin comes from `INITIAL_ADMIN_EMAIL` / `INITIAL_ADMIN_PASSWORD`.
  These are read by the **manual** seed (`npm run db:seed`), which is run once
  after the first production deploy — the seed does **not** run during a Vercel
  build. After first sign-in, change the password from `/admin/change-password`;
  `INITIAL_ADMIN_PASSWORD` only affects a fresh seed thereafter.
- Password reset: `/admin/forgot-password`; change password: `/admin/change-password`.

## Sections (Phase 4)

Sidebar links appear only for permissions you hold.

### مطالب — `/admin/articles`
- List with search, status filter, sort, pagination, soft-deleted toggle.
- **مطلب جدید**: title, slug (auto), subtitle, summary, content type, status,
  primary category, author, featured image, primary source, tags (multi-select),
  body (plain paragraphs — full TipTap editor arrives in Phase 5), and basic SEO
  (meta title/description, canonical, noindex).
- Row actions: ویرایش / حذف (soft) / بازیابی — shown per permission.
- Publishing a draft sets `publishedAt`; a later slug change atomically preserves the old public URL with a permanent 301 redirect.

### دسته‌بندی‌ها — `/admin/categories`
- Parent/child hierarchy (circular parenting is prevented).
- Deleting a category that still has articles is refused — move the articles first.

### برچسب‌ها — `/admin/tags`
- Create/edit/soft-delete/restore; duplicate names are rejected.
- Tags can be merged via the API/service (`tag.merge`).

### منابع — `/admin/sources`
- Type, credibility level, official flag, website. **تأیید** raises credibility to VERIFIED.

### کتابخانه رسانه — `/admin/media`
- Real upload (image / mp4·webm / mp3 / PDF, ≤25 MB). Grid view with type, size,
  Alt, uploader, date, folder. Edit Alt/Caption/Credit. In-use files can't be deleted.

## اتاق خبر هوشمند (Newsroom) — `/admin/newsroom` (Phase 10A)

An automated pipeline that collects, de-duplicates, clusters, scores and
trust-evaluates news from **approved** sources only, and lets an editor turn
a promising item into a private editorial `DRAFT` — never publishes anything
itself. See [AI_NEWSROOM.md](./AI_NEWSROOM.md) for the full technical picture.

- **`/admin/newsroom`** — review queue by importance bucket
  (urgent/high/review/low) plus rejected/drafted tabs. Per item: **ساخت
  پیش‌نویس** (create draft), **بازپردازش** (reprocess — re-scores with current
  settings), **بازتولید پیش‌نویس** (regenerate — only once a draft exists),
  **رد** (reject). **اجرای جمع‌آوری** triggers a manual collection run.
- **`/admin/newsroom/settings`** — the kill switches (`اتاق خبر فعال`,
  `جمع‌آوری فعال`, `هوش مصنوعی فعال`), run limits, the 12 scoring weights,
  reset-to-defaults, and the retention cleanup card (پیش‌نمایش / اجرای
  پاک‌سازی). AI is used only to draft the article text (never scoring or the
  publish decision) — see AI_NEWSROOM.md's "Rule-based vs AI responsibilities".
- **`/admin/newsroom/sources`** — every source must be reviewed and approved
  here (feed URL, method, trust level) before collection ever polls it;
  **Test Feed** checks a URL without saving anything if it fails. Never add a
  source without confirming its Terms of Service/robots.txt allow this.
- **`/admin/newsroom/clusters`** — merge several clusters (pick the primary)
  or open one to split specific items into a new cluster.
- **`/admin/newsroom/runs`** — history of collection runs and their per-stage
  outcome (useful when a source starts failing or a run reports errors).
- A created draft always lands in **`/admin/articles`** as a normal `DRAFT` —
  review, edit and publish it exactly like any other article; nothing here
  bypasses the ordinary editorial workflow.

## Users — `/admin/users`
Manage users, deactivate/reactivate, and revoke sessions (requires `user.manage`).

## Notes
- Every destructive action is a **soft delete**; use the "نمایش حذف‌شده‌ها" toggle
  and **بازیابی** to restore.
- All actions are recorded in the Audit Log.

## SEO settings (Phase 7)

Organization schema, the publisher block, and feeds read from the `general`
Site Setting (JSON). All fields are optional and omitted when empty — never
enter fabricated data:

- `siteName`, `alternateName`, `description`, `logo` (absolute or root-relative)
- `foundingDate` (only if genuinely known)
- `email`, `phone` (only if public — become the Organization contact point)
- `socials.{telegram,instagram,x,whatsapp}` — **use full absolute URLs**; handles
  are ignored so no profile URL is invented.

### Redirects

Add a `Redirect` row (`from` → `to`, `permanent`) when an article/category slug
changes. The resolver follows chains and blocks cycles automatically (a loop
returns 404 rather than bouncing). Paths are root-relative (e.g.
`/news/old-slug` → `/news/new-slug`).

See `SEO.md` for the full metadata / schema / sitemap / news / RSS / robots design.
