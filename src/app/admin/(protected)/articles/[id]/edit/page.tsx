import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermissionPage } from "@/server/auth/current-user";
import { getServiceContext } from "@/server/services/session-context";
import { articleService } from "@/server/services/article.service";
import { PERMISSIONS } from "@/server/rbac/permissions";
import { ArticleForm } from "../../article-form";
import { updateArticleAction } from "../../actions";
import { loadArticleFormOptions } from "../../options";

export const metadata: Metadata = { title: "ویرایش مطلب", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Reconstruct plain paragraph text from a stored TipTap doc. */
function docToText(body: unknown): string {
  const doc = body as { content?: { content?: { text?: string }[] }[] } | null;
  if (!doc?.content) return "";
  return doc.content
    .map((node) => (node.content ?? []).map((c) => c.text ?? "").join(""))
    .filter(Boolean)
    .join("\n\n");
}

export default async function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermissionPage(PERMISSIONS.ARTICLE_VIEW, "/admin/articles");
  const { id } = await params;
  const ctx = await getServiceContext();
  const article = await articleService.getById(ctx, id).catch(() => null);
  if (!article) notFound();

  const options = await loadArticleFormOptions(ctx);
  const primarySource = article.sources.find((s) => s.isPrimary) ?? article.sources[0];

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">ویرایش مطلب</h1>
      <ArticleForm
        action={updateArticleAction}
        options={options}
        initial={{
          id: article.id,
          title: article.title,
          slug: article.slug,
          subtitle: article.subtitle,
          summary: article.summary,
          body: docToText(article.bodyJson),
          contentType: article.contentType,
          status: article.status,
          primaryCategoryId: article.primaryCategoryId,
          authorId: article.authorId,
          featuredImageId: article.featuredImageId,
          tagIds: article.tags.map((t) => t.tag.id),
          sourceId: primarySource?.source.id,
          metaTitle: article.metaTitle,
          metaDescription: article.metaDescription,
          canonicalUrl: article.canonicalUrl,
          noindex: article.noindex,
        }}
      />
    </div>
  );
}
