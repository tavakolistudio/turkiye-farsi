"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertSameOrigin } from "@/server/security/csrf";
import { getServiceContext } from "@/server/services/session-context";
import { articleService } from "@/server/services/article.service";
import { articleLinksService } from "@/server/services/article-links.service";
import { hasPermission } from "@/server/rbac/authz";
import { PERMISSIONS } from "@/server/rbac/permissions";
import { toFormError, str, bool, strList, type FormState } from "@/lib/forms";
import type { ServiceContext } from "@/server/services/context";

/** Wrap plain textarea body into a minimal TipTap/ProseMirror document. */
function bodyToJson(text: string | undefined) {
  if (!text) return undefined;
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return {
    type: "doc",
    content: paragraphs.map((p) => ({ type: "paragraph", content: [{ type: "text", text: p }] })),
  };
}

function payload(fd: FormData) {
  return {
    title: str(fd, "title"),
    slug: str(fd, "slug"),
    subtitle: str(fd, "subtitle"),
    summary: str(fd, "summary"),
    bodyJson: bodyToJson(str(fd, "body")),
    contentType: str(fd, "contentType"),
    status: str(fd, "status"),
    primaryCategoryId: str(fd, "primaryCategoryId"),
    authorId: str(fd, "authorId"),
    featuredImageId: str(fd, "featuredImageId"),
    tagIds: strList(fd, "tagIds"),
    metaTitle: str(fd, "metaTitle"),
    metaDescription: str(fd, "metaDescription"),
    canonicalUrl: str(fd, "canonicalUrl"),
    noindex: bool(fd, "noindex"),
  };
}

/** Attach the chosen source (if any) when the actor may manage sources. */
async function maybeAttachSource(ctx: ServiceContext, articleId: string, sourceId?: string) {
  if (!sourceId) return;
  if (!hasPermission(ctx.actor, PERMISSIONS.ARTICLE_MANAGE_SOURCES)) return;
  await articleLinksService.attachSource(ctx, articleId, { sourceId, isPrimary: true });
}

export async function createArticleAction(_prev: FormState, fd: FormData): Promise<FormState> {
  try {
    await assertSameOrigin();
    const ctx = await getServiceContext();
    const created = await articleService.create(ctx, payload(fd));
    await maybeAttachSource(ctx, created.id, str(fd, "sourceId"));
  } catch (e) {
    return toFormError(e);
  }
  revalidatePath("/admin/articles");
  redirect("/admin/articles");
}

export async function updateArticleAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const id = str(fd, "id");
  try {
    await assertSameOrigin();
    const ctx = await getServiceContext();
    if (!id) throw new Error("missing id");
    await articleService.update(ctx, id, payload(fd));
    await maybeAttachSource(ctx, id, str(fd, "sourceId"));
  } catch (e) {
    return toFormError(e);
  }
  revalidatePath("/admin/articles");
  redirect("/admin/articles");
}

export async function deleteArticleAction(id: string): Promise<FormState> {
  try {
    await assertSameOrigin();
    await articleService.softDelete(await getServiceContext(), id);
  } catch (e) {
    return toFormError(e);
  }
  revalidatePath("/admin/articles");
  return { ok: true };
}

export async function restoreArticleAction(id: string): Promise<FormState> {
  try {
    await assertSameOrigin();
    await articleService.restore(await getServiceContext(), id);
  } catch (e) {
    return toFormError(e);
  }
  revalidatePath("/admin/articles");
  return { ok: true };
}
