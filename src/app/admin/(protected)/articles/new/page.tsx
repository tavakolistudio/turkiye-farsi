import type { Metadata } from "next";
import { requirePermissionPage } from "@/server/auth/current-user";
import { getServiceContext } from "@/server/services/session-context";
import { PERMISSIONS } from "@/server/rbac/permissions";
import { ArticleForm } from "../article-form";
import { createArticleAction } from "../actions";
import { loadArticleFormOptions } from "../options";

export const metadata: Metadata = { title: "مطلب جدید", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function NewArticlePage() {
  await requirePermissionPage(PERMISSIONS.ARTICLE_CREATE, "/admin/articles/new");
  const options = await loadArticleFormOptions(await getServiceContext());
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">مطلب جدید</h1>
      <ArticleForm action={createArticleAction} options={options} />
    </div>
  );
}
