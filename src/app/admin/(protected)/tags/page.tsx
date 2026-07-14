import type { Metadata } from "next";
import Link from "next/link";
import { requirePermissionPage } from "@/server/auth/current-user";
import { getServiceContext } from "@/server/services/session-context";
import { tagService } from "@/server/services/tag.service";
import { hasPermission } from "@/server/rbac/authz";
import { PERMISSIONS } from "@/server/rbac/permissions";
import { listQuerySchema } from "@/lib/api/pagination";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { SearchForm } from "@/components/admin/search-form";
import { Pagination } from "@/components/admin/pagination";
import { RowActions } from "@/components/admin/row-actions";
import { deleteTagAction, restoreTagAction } from "./actions";

export const metadata: Metadata = { title: "برچسب‌ها", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function TagsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const actor = await requirePermissionPage(PERMISSIONS.TAG_VIEW, "/admin/tags");
  const sp = await searchParams;
  const query = listQuerySchema.parse(sp);
  const { rows, meta } = await tagService.list(await getServiceContext(), query);

  const canCreate = hasPermission(actor, PERMISSIONS.TAG_CREATE);
  const canDelete = hasPermission(actor, PERMISSIONS.TAG_DELETE);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">برچسب‌ها</h1>
        {canCreate && (
          <Link href="/admin/tags/new" className={buttonVariants({ size: "sm" })}>
            برچسب جدید
          </Link>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchForm action="/admin/tags" defaultValue={sp.search} placeholder="جستجوی برچسب…" />
        <Link
          href={sp.includeDeleted ? "/admin/tags" : "/admin/tags?includeDeleted=true"}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          {sp.includeDeleted ? "نمایش فعال‌ها" : "نمایش حذف‌شده‌ها"}
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
          برچسبی یافت نشد.
        </div>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-right text-muted-foreground">
              <tr>
                <th className="p-3 font-medium">نام</th>
                <th className="p-3 font-medium">نامک</th>
                <th className="p-3 font-medium">تعداد مطالب</th>
                <th className="p-3 font-medium">وضعیت</th>
                <th className="p-3 font-medium">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} className="border-b border-border last:border-0">
                  <td className="p-3 font-medium">{t.name}</td>
                  <td className="p-3" dir="ltr">{t.slug}</td>
                  <td className="p-3">{t._count.articles}</td>
                  <td className="p-3">
                    {t.deletedAt ? <Badge tone="red">حذف‌شده</Badge> : <Badge tone="green">فعال</Badge>}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-2">
                      {!t.deletedAt && (
                        <Link
                          href={`/admin/tags/${t.id}/edit`}
                          className={buttonVariants({ variant: "outline", size: "sm" })}
                        >
                          ویرایش
                        </Link>
                      )}
                      <RowActions
                        id={t.id}
                        deleted={!!t.deletedAt}
                        onDelete={deleteTagAction}
                        onRestore={restoreTagAction}
                        canDelete={canDelete}
                        canRestore={canDelete}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Pagination basePath="/admin/tags" params={sp} page={meta.page ?? 1} totalPages={meta.totalPages ?? 1} />
    </div>
  );
}
