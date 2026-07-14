# Admin Guide (پنل مدیریت)

The admin panel lives at `/admin` and is fully Persian/RTL. Access requires a
signed-in user; each section and action checks the user's permissions on the server.

## Sign in
- Go to `/admin` → you're redirected to `/admin/login`.
- The initial super admin comes from `INITIAL_ADMIN_EMAIL` / `INITIAL_ADMIN_PASSWORD`.
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
- Publishing a draft sets `publishedAt`; the slug is locked after publication.

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

## Users — `/admin/users`
Manage users, deactivate/reactivate, and revoke sessions (requires `user.manage`).

## Notes
- Every destructive action is a **soft delete**; use the "نمایش حذف‌شده‌ها" toggle
  and **بازیابی** to restore.
- All actions are recorded in the Audit Log.
