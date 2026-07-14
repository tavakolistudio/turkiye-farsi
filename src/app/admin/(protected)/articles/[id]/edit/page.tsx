import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermissionPage } from "@/server/auth/current-user";
import { getServiceContext } from "@/server/services/session-context";
import { articleService } from "@/server/services/article.service";
import { PERMISSIONS } from "@/server/rbac/permissions";
import { ArticleForm } from "../../article-form";
import { updateArticleAction } from "../../actions";
import { loadArticleFormOptions } from "../../options";
import { EditorialSidebar } from "@/components/admin/editorial-sidebar";
import { editorialWorkflowService } from "@/server/services/editorial-workflow.service";
import { revisionService } from "@/server/services/revision.service";
import { correctionService } from "@/server/services/correction.service";
import { publishValidationService } from "@/server/services/publish-validation.service";
import { availableWorkflowActions, WORKFLOW_TRANSITIONS } from "@/lib/editorial/workflow";
import { hasPermission } from "@/server/rbac/authz";

export const metadata: Metadata = { title: "ویرایش مطلب", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermissionPage(PERMISSIONS.ARTICLE_VIEW, "/admin/articles");
  const { id } = await params;
  const ctx = await getServiceContext();
  const article = await articleService.getById(ctx, id).catch(() => null);
  if (!article) notFound();

  const [options, timeline, corrections, comments, checklist, revisions] = await Promise.all([
    loadArticleFormOptions(ctx),
    editorialWorkflowService.timeline(ctx, id),
    correctionService.list(ctx, id),
    editorialWorkflowService.comments(ctx, id),
    publishValidationService.forArticle(id),
    hasPermission(ctx.actor, PERMISSIONS.ARTICLE_VIEW_REVISION) ? revisionService.list(ctx, id) : Promise.resolve([]),
  ]);
  const primarySource = article.sources.find((s) => s.isPrimary) ?? article.sources[0];
  const actions = availableWorkflowActions(article.status).filter((action) => hasPermission(ctx.actor, WORKFLOW_TRANSITIONS[action].permission));

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">ویرایش مطلب</h1>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <ArticleForm
          action={updateArticleAction}
          options={options}
          initial={{
          id: article.id,
          title: article.title,
          slug: article.slug,
          subtitle: article.subtitle,
          summary: article.summary,
          bodyJson: article.bodyJson,
          currentVersion: article.currentVersion,
          contentType: article.contentType,
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
          autosave
        />
        <EditorialSidebar
          article={{ id: article.id, status: article.status, currentVersion: article.currentVersion, assignedEditorId: article.assignedEditorId }}
          actions={actions}
          editors={options.authors}
          checklist={checklist}
          revisions={revisions.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() }))}
          timeline={timeline.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() }))}
          corrections={corrections.map((item) => ({ id: item.id, title: item.title, description: item.description, correctionType: item.correctionType, isPublished: item.isPublished }))}
          comments={comments.map((item) => ({ id: item.id, body: item.body, isResolved: item.isResolved, author: item.author, replies: item.replies.map((reply) => ({ id: reply.id, body: reply.body, author: reply.author })) }))}
        />
      </div>
    </div>
  );
}
