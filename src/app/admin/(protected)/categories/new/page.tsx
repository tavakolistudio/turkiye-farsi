import type { Metadata } from "next";
import { requirePermissionPage } from "@/server/auth/current-user";
import { getServiceContext } from "@/server/services/session-context";
import { categoryService } from "@/server/services/category.service";
import { PERMISSIONS } from "@/server/rbac/permissions";
import { CategoryForm } from "../category-form";
import { createCategoryAction } from "../actions";

export const metadata: Metadata = { title: "دسته‌بندی جدید", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function NewCategoryPage() {
  await requirePermissionPage(PERMISSIONS.CATEGORY_CREATE, "/admin/categories/new");
  const ctx = await getServiceContext();
  const { rows } = await categoryService.list(ctx, {
    page: 1,
    pageSize: 100,
    order: "asc",
    sort: "name",
    includeDeleted: false,
  });

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">دسته‌بندی جدید</h1>
      <CategoryForm action={createCategoryAction} parents={rows.map((r) => ({ id: r.id, name: r.name }))} />
    </div>
  );
}
