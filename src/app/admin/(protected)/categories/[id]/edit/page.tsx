import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermissionPage } from "@/server/auth/current-user";
import { getServiceContext } from "@/server/services/session-context";
import { categoryService } from "@/server/services/category.service";
import { PERMISSIONS } from "@/server/rbac/permissions";
import { CategoryForm } from "../../category-form";
import { TransferArticles } from "../../transfer-articles";
import { updateCategoryAction } from "../../actions";

export const metadata: Metadata = { title: "ویرایش دسته‌بندی", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function EditCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermissionPage(PERMISSIONS.CATEGORY_UPDATE, "/admin/categories");
  const { id } = await params;
  const ctx = await getServiceContext();

  const category = await categoryService.getById(ctx, id).catch(() => null);
  if (!category) notFound();

  const [{ rows }, articleCount] = await Promise.all([
    categoryService.list(ctx, {
      page: 1,
      pageSize: 100,
      order: "asc",
      sort: "name",
      includeDeleted: false,
    }),
    categoryService.articleCount(ctx, id),
  ]);

  // Valid transfer targets: every other active category except this one.
  const targets = rows.filter((r) => r.id !== category.id).map((r) => ({ id: r.id, name: r.name }));

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">ویرایش دسته‌بندی</h1>
      <CategoryForm
        action={updateCategoryAction}
        parents={rows.map((r) => ({ id: r.id, name: r.name }))}
        initial={{
          id: category.id,
          name: category.name,
          slug: category.slug,
          description: category.description,
          parentId: category.parentId,
          order: category.order,
          isActive: category.isActive,
          metaTitle: category.metaTitle,
          metaDescription: category.metaDescription,
        }}
      />

      <TransferArticles fromId={category.id} articleCount={articleCount} targets={targets} />
    </div>
  );
}
