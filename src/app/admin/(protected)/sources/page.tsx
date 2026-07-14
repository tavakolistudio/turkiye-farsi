import type { Metadata } from "next";
import Link from "next/link";
import { requirePermissionPage } from "@/server/auth/current-user";
import { getServiceContext } from "@/server/services/session-context";
import { sourceService } from "@/server/services/source.service";
import { hasPermission } from "@/server/rbac/authz";
import { PERMISSIONS } from "@/server/rbac/permissions";
import { listQuerySchema } from "@/lib/api/pagination";
import { SOURCE_TYPE_LABELS, CREDIBILITY_LABELS } from "@/lib/content-enums";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { SearchForm } from "@/components/admin/search-form";
import { Pagination } from "@/components/admin/pagination";
import { RowActions } from "@/components/admin/row-actions";
import { ActionButton } from "@/components/admin/action-button";
import { deleteSourceAction, restoreSourceAction, verifySourceAction } from "./actions";

export const metadata: Metadata = { title: "منابع", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function SourcesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const actor = await requirePermissionPage(PERMISSIONS.SOURCE_VIEW, "/admin/sources");
  const sp = await searchParams;
  const query = listQuerySchema.parse(sp);
  const { rows, meta } = await sourceService.list(await getServiceContext(), query);

  const canCreate = hasPermission(actor, PERMISSIONS.SOURCE_CREATE);
  const canDelete = hasPermission(actor, PERMISSIONS.SOURCE_DELETE);
  const canVerify = hasPermission(actor, PERMISSIONS.SOURCE_VERIFY);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">منابع</h1>
        {canCreate && (
          <Link href="/admin/sources/new" className={buttonVariants({ size: "sm" })}>
            منبع جدید
          </Link>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchForm action="/admin/sources" defaultValue={sp.search} placeholder="جستجوی منبع…" />
        <Link
          href={sp.includeDeleted ? "/admin/sources" : "/admin/sources?includeDeleted=true"}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          {sp.includeDeleted ? "نمایش فعال‌ها" : "نمایش حذف‌شده‌ها"}
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
          منبعی یافت نشد.
        </div>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-right text-muted-foreground">
              <tr>
                <th className="p-3 font-medium">نام</th>
                <th className="p-3 font-medium">نوع</th>
                <th className="p-3 font-medium">اعتبار</th>
                <th className="p-3 font-medium">مطالب</th>
                <th className="p-3 font-medium">وضعیت</th>
                <th className="p-3 font-medium">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0">
                  <td className="p-3 font-medium">{s.name}</td>
                  <td className="p-3">{SOURCE_TYPE_LABELS[s.sourceType]}</td>
                  <td className="p-3">
                    <Badge tone={s.credibilityLevel === "VERIFIED" ? "green" : "muted"}>
                      {CREDIBILITY_LABELS[s.credibilityLevel]}
                    </Badge>
                  </td>
                  <td className="p-3">{s._count.articles}</td>
                  <td className="p-3">
                    {s.deletedAt ? <Badge tone="red">حذف‌شده</Badge> : s.isActive ? <Badge tone="green">فعال</Badge> : <Badge>غیرفعال</Badge>}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {!s.deletedAt && canVerify && s.credibilityLevel !== "VERIFIED" && (
                        <ActionButton id={s.id} action={verifySourceAction}>تأیید</ActionButton>
                      )}
                      {!s.deletedAt && (
                        <Link href={`/admin/sources/${s.id}/edit`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                          ویرایش
                        </Link>
                      )}
                      <RowActions
                        id={s.id}
                        deleted={!!s.deletedAt}
                        onDelete={deleteSourceAction}
                        onRestore={restoreSourceAction}
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

      <Pagination basePath="/admin/sources" params={sp} page={meta.page ?? 1} totalPages={meta.totalPages ?? 1} />
    </div>
  );
}
