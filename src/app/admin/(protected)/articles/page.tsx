import type { Metadata } from "next";
import Link from "next/link";
import { requirePermissionPage } from "@/server/auth/current-user";
import { getServiceContext } from "@/server/services/session-context";
import { articleService } from "@/server/services/article.service";
import { hasPermission } from "@/server/rbac/authz";
import { PERMISSIONS } from "@/server/rbac/permissions";
import { listQuerySchema } from "@/lib/api/pagination";
import { ARTICLE_STATUSES, ARTICLE_STATUS_LABELS, CONTENT_TYPE_LABELS } from "@/lib/content-enums";
import { formatJalali } from "@/lib/dates";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { SearchForm } from "@/components/admin/search-form";
import { Pagination } from "@/components/admin/pagination";
import { RowActions } from "@/components/admin/row-actions";
import { deleteArticleAction, restoreArticleAction } from "./actions";

export const metadata: Metadata = { title: "مطالب", robots: { index: false } };
export const dynamic = "force-dynamic";

const statusTone: Record<string, "green" | "yellow" | "red" | "muted" | "blue"> = {
  PUBLISHED: "green",
  SCHEDULED: "blue",
  IN_REVIEW: "yellow",
  NEEDS_CORRECTION: "yellow",
  REJECTED: "red",
  ARCHIVED: "muted",
  UNPUBLISHED: "muted",
  APPROVED: "blue",
  DRAFT: "muted",
};

export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const actor = await requirePermissionPage(PERMISSIONS.ARTICLE_VIEW, "/admin/articles");
  const sp = await searchParams;
  const query = { ...listQuerySchema.parse(sp), status: sp.status };
  const { rows, meta } = await articleService.list(await getServiceContext(), query);

  const canCreate = hasPermission(actor, PERMISSIONS.ARTICLE_CREATE);
  const canDelete = hasPermission(actor, PERMISSIONS.ARTICLE_DELETE);
  const canRestore = hasPermission(actor, PERMISSIONS.ARTICLE_RESTORE);
  const canEdit =
    hasPermission(actor, PERMISSIONS.ARTICLE_UPDATE_ANY) || hasPermission(actor, PERMISSIONS.ARTICLE_UPDATE_OWN);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">مطالب</h1>
        {canCreate && (
          <Link href="/admin/articles/new" className={buttonVariants({ size: "sm" })}>
            مطلب جدید
          </Link>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchForm action="/admin/articles" defaultValue={sp.search} placeholder="جستجوی مطلب…">
          <select name="status" defaultValue={sp.status ?? ""} className="h-9 rounded-md border border-input bg-card px-2 text-sm">
            <option value="">همه وضعیت‌ها</option>
            {ARTICLE_STATUSES.map((s) => (
              <option key={s} value={s}>{ARTICLE_STATUS_LABELS[s]}</option>
            ))}
          </select>
        </SearchForm>
        <Link
          href={sp.includeDeleted ? "/admin/articles" : "/admin/articles?includeDeleted=true"}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          {sp.includeDeleted ? "نمایش فعال‌ها" : "نمایش حذف‌شده‌ها"}
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
          مطلبی یافت نشد.
        </div>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-right text-muted-foreground">
              <tr>
                <th className="p-3 font-medium">عنوان</th>
                <th className="p-3 font-medium">نوع</th>
                <th className="p-3 font-medium">نویسنده</th>
                <th className="p-3 font-medium">دسته‌بندی</th>
                <th className="p-3 font-medium">وضعیت</th>
                <th className="p-3 font-medium">بازدید</th>
                <th className="p-3 font-medium">تاریخ</th>
                <th className="p-3 font-medium">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} className="border-b border-border last:border-0">
                  <td className="p-3 font-medium">{a.title}</td>
                  <td className="p-3">{CONTENT_TYPE_LABELS[a.contentType]}</td>
                  <td className="p-3">{a.author.name}</td>
                  <td className="p-3">{a.primaryCategory?.name ?? "—"}</td>
                  <td className="p-3">
                    {a.deletedAt ? (
                      <Badge tone="red">حذف‌شده</Badge>
                    ) : (
                      <Badge tone={statusTone[a.status]}>{ARTICLE_STATUS_LABELS[a.status]}</Badge>
                    )}
                  </td>
                  <td className="p-3">{a.viewCount}</td>
                  <td className="p-3 whitespace-nowrap">{formatJalali(a.createdAt)}</td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-2">
                      {!a.deletedAt && canEdit && (
                        <Link href={`/admin/articles/${a.id}/edit`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                          ویرایش
                        </Link>
                      )}
                      <RowActions
                        id={a.id}
                        deleted={!!a.deletedAt}
                        onDelete={deleteArticleAction}
                        onRestore={restoreArticleAction}
                        canDelete={canDelete}
                        canRestore={canRestore}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Pagination basePath="/admin/articles" params={sp} page={meta.page ?? 1} totalPages={meta.totalPages ?? 1} />
    </div>
  );
}
