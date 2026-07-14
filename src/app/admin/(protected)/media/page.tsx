import type { Metadata } from "next";
import Link from "next/link";
import { requirePermissionPage } from "@/server/auth/current-user";
import { getServiceContext } from "@/server/services/session-context";
import { mediaService } from "@/server/services/media.service";
import { hasPermission } from "@/server/rbac/authz";
import { PERMISSIONS } from "@/server/rbac/permissions";
import { listQuerySchema } from "@/lib/api/pagination";
import { formatJalali } from "@/lib/dates";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { SearchForm } from "@/components/admin/search-form";
import { Pagination } from "@/components/admin/pagination";
import { RowActions } from "@/components/admin/row-actions";
import { MediaUpload } from "./media-upload";
import { deleteMediaAction, restoreMediaAction } from "./actions";

export const metadata: Metadata = { title: "رسانه‌ها", robots: { index: false } };
export const dynamic = "force-dynamic";

function fileKind(mime: string) {
  if (mime.startsWith("image/")) return { label: "تصویر", tone: "blue" as const };
  if (mime.startsWith("video/")) return { label: "ویدئو", tone: "yellow" as const };
  if (mime.startsWith("audio/")) return { label: "صوت", tone: "green" as const };
  return { label: "فایل", tone: "muted" as const };
}

function humanSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default async function MediaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const actor = await requirePermissionPage(PERMISSIONS.MEDIA_VIEW, "/admin/media");
  const sp = await searchParams;
  const query = listQuerySchema.parse(sp);
  const { rows, meta } = await mediaService.list(await getServiceContext(), {
    ...query,
    mimePrefix: sp.type ? `${sp.type}/` : undefined,
  });

  const canUpload = hasPermission(actor, PERMISSIONS.MEDIA_UPLOAD);
  const canDelete = hasPermission(actor, PERMISSIONS.MEDIA_DELETE);
  const canRestore = hasPermission(actor, PERMISSIONS.MEDIA_RESTORE);
  const canUpdate = hasPermission(actor, PERMISSIONS.MEDIA_UPDATE);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">کتابخانه رسانه</h1>

      {canUpload && <MediaUpload />}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchForm action="/admin/media" defaultValue={sp.search} placeholder="جستجوی فایل…">
          <select name="type" defaultValue={sp.type ?? ""} className="h-9 rounded-md border border-input bg-card px-2 text-sm">
            <option value="">همه انواع</option>
            <option value="image">تصویر</option>
            <option value="video">ویدئو</option>
            <option value="audio">صوت</option>
            <option value="application">فایل</option>
          </select>
        </SearchForm>
        <Link
          href={sp.includeDeleted ? "/admin/media" : "/admin/media?includeDeleted=true"}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          {sp.includeDeleted ? "نمایش فعال‌ها" : "نمایش حذف‌شده‌ها"}
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
          رسانه‌ای یافت نشد.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {rows.map((m) => {
            const kind = fileKind(m.mimeType);
            return (
              <Card key={m.id} className="overflow-hidden">
                <div className="flex aspect-video items-center justify-center bg-muted">
                  {m.mimeType.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.publicUrl} alt={m.alt ?? ""} className="h-full w-full object-cover" />
                  ) : (
                    <Badge tone={kind.tone}>{kind.label}</Badge>
                  )}
                </div>
                <div className="space-y-1 p-3 text-xs">
                  <p className="truncate font-medium" dir="ltr" title={m.originalFilename}>
                    {m.originalFilename}
                  </p>
                  <p className="text-muted-foreground">
                    {kind.label} · {humanSize(m.size)}
                    {m.folder ? ` · ${m.folder.name}` : ""}
                  </p>
                  <p className="text-muted-foreground">{m.alt ? `Alt: ${m.alt}` : "بدون Alt"}</p>
                  <p className="text-muted-foreground">
                    {m.uploadedBy?.name ?? "—"} · {formatJalali(m.createdAt)}
                  </p>
                  <div className="flex items-center justify-between pt-1">
                    {canUpdate && !m.deletedAt ? (
                      <Link href={`/admin/media/${m.id}/edit`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                        ویرایش
                      </Link>
                    ) : (
                      <span />
                    )}
                    <RowActions
                      id={m.id}
                      deleted={!!m.deletedAt}
                      onDelete={deleteMediaAction}
                      onRestore={restoreMediaAction}
                      canDelete={canDelete}
                      canRestore={canRestore}
                    />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Pagination basePath="/admin/media" params={sp} page={meta.page ?? 1} totalPages={meta.totalPages ?? 1} />
    </div>
  );
}
