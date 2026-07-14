"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertSameOrigin } from "@/server/security/csrf";
import { getServiceContext } from "@/server/services/session-context";
import { tagService } from "@/server/services/tag.service";
import { toFormError, str, type FormState } from "@/lib/forms";

function payload(fd: FormData) {
  return { name: str(fd, "name"), slug: str(fd, "slug"), description: str(fd, "description") };
}

export async function createTagAction(_prev: FormState, fd: FormData): Promise<FormState> {
  try {
    await assertSameOrigin();
    await tagService.create(await getServiceContext(), payload(fd));
  } catch (e) {
    return toFormError(e);
  }
  revalidatePath("/admin/tags");
  redirect("/admin/tags");
}

export async function updateTagAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const id = str(fd, "id");
  try {
    await assertSameOrigin();
    if (!id) throw new Error("missing id");
    await tagService.update(await getServiceContext(), id, payload(fd));
  } catch (e) {
    return toFormError(e);
  }
  revalidatePath("/admin/tags");
  redirect("/admin/tags");
}

export async function deleteTagAction(id: string): Promise<FormState> {
  try {
    await assertSameOrigin();
    await tagService.softDelete(await getServiceContext(), id);
  } catch (e) {
    return toFormError(e);
  }
  revalidatePath("/admin/tags");
  return { ok: true };
}

export async function restoreTagAction(id: string): Promise<FormState> {
  try {
    await assertSameOrigin();
    await tagService.restore(await getServiceContext(), id);
  } catch (e) {
    return toFormError(e);
  }
  revalidatePath("/admin/tags");
  return { ok: true };
}

export async function mergeTagsAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const sourceTagId = str(fd, "sourceTagId");
  const targetTagId = str(fd, "targetTagId");
  try {
    await assertSameOrigin();
    if (!sourceTagId || !targetTagId) throw new Error("missing ids");
    await tagService.merge(await getServiceContext(), sourceTagId, targetTagId);
  } catch (e) {
    return toFormError(e);
  }
  revalidatePath("/admin/tags");
  redirect("/admin/tags");
}
