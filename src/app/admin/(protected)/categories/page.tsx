import type { Metadata } from "next";
import Link from "next/link";
import { requirePermissionPage } from "@/server/auth/current-user";
import { getServiceContext } from "@/server/services/session-context";
import { categoryService } from "@/server/services/category.service";
import { hasPermission } from "@/server/rbac/authz";
import { PERMISSIONS } from "@/server/rbac/permissions";
import { listQuerySchema } from "@/lib/api/pagination";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { SearchForm } from "@/components/admin/search-form";
import { Pagination } from "@/components/admin/pagination";
import { RowActions } from "@/components/admin/row-actions";
import { deleteCategoryAction, restoreCategoryAction } from "./actions";

export const metadata: Metadata = { title: "دسته‌بندی‌ها", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const actor = await requirePermissionPage(PERMISSIONS.CATEGORY_VIEW, "/admin/categories");
  const sp = await searchParams;
  const query = listQuerySchema.parse(sp);
  const ctx = await getServiceContext();
  const { rows, meta } = await categoryService.list(ctx, query);

  const canCreate = hasPermission(actor, PERMISSIONS.CATEGORY_CREATE);
  const canDelete = hasPermission(actor, PERMISSIONS.CATEGORY_DELETE);
  const canRestore = hasPermission(actor, PERMISSIONS.CATEGORY_RESTORE);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">دسته‌بندی‌ها</h1>
        {canCreate && (
          <Link href="/admin/categories/new" className={buttonVariants({ size: "sm" })}>
            دسته‌بندی جدید
          </Link>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchForm action="/admin/categories" defaultValue={sp.search} placeholder="جستجوی دسته‌بندی…" />
        <Link
          href={sp.includeDeleted ? "/admin/categories" : "/admin/categories?includeDeleted=true"}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          {sp.includeDeleted ? "نمایش فعال‌ها" : "نمایش حذف‌شده‌ها"}
        </Link>
      </div>

      {rows.length === 0 ? (
        <EmptyState />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-right text-muted-foreground">
              <tr>
                <th className="p-3 font-medium">نام</th>
                <th className="p-3 font-medium">نامک</th>
                <th className="p-3 font-medium">والد</th>
                <th className="p-3 font-medium">ترتیب</th>
                <th className="p-3 font-medium">مطالب</th>
                <th className="p-3 font-medium">وضعیت</th>
                <th className="p-3 font-medium">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const articleCount = c._count.articles + c._count.primaryArticles;
                return (
                  <tr key={c.id} className="border-b border-border last:border-0">
                    <td className="p-3 font-medium">{c.name}</td>
                    <td className="p-3" dir="ltr">{c.slug}</td>
                    <td className="p-3">{c.parent?.name ?? "—"}</td>
                    <td className="p-3">{c.order}</td>
                    <td className="p-3">{articleCount}</td>
                    <td className="p-3">
                      {c.deletedAt ? (
                        <Badge tone="red">حذف‌شده</Badge>
                      ) : c.isActive ? (
                        <Badge tone="green">فعال</Badge>
                      ) : (
                        <Badge>غیرفعال</Badge>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-end gap-2">
                        {!c.deletedAt && (
                          <Link
                            href={`/admin/categories/${c.id}/edit`}
                            className={buttonVariants({ variant: "outline", size: "sm" })}
                          >
                            ویرایش
                          </Link>
                        )}
                        <RowActions
                          id={c.id}
                          deleted={!!c.deletedAt}
                          onDelete={deleteCategoryAction}
                          onRestore={restoreCategoryAction}
                          canDelete={canDelete}
                          canRestore={canRestore}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <Pagination
        basePath="/admin/categories"
        params={sp}
        page={meta.page ?? 1}
        totalPages={meta.totalPages ?? 1}
      />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
      دسته‌بندی‌ای یافت نشد.
    </div>
  );
}
