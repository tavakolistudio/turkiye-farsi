"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertSameOrigin } from "@/server/security/csrf";
import { getServiceContext } from "@/server/services/session-context";
import { mediaService } from "@/server/services/media.service";
import { toFormError, str, type FormState } from "@/lib/forms";

/** Real upload from a multipart form field named `file`. */
export async function uploadMediaAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "لطفاً یک فایل انتخاب کنید." };
  }
  try {
    await assertSameOrigin();
    const ctx = await getServiceContext();
    const buffer = Buffer.from(await file.arrayBuffer());
    await mediaService.upload(ctx, {
      buffer,
      originalFilename: file.name || "upload",
      mimeType: file.type || "application/octet-stream",
      size: buffer.length,
      folderId: str(fd, "folderId"),
    });
  } catch (e) {
    return toFormError(e);
  }
  revalidatePath("/admin/media");
  return { ok: true };
}

export async function updateMediaMetaAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const id = str(fd, "id");
  try {
    await assertSameOrigin();
    if (!id) throw new Error("missing id");
    await mediaService.updateMeta(await getServiceContext(), id, {
      alt: str(fd, "alt"),
      caption: str(fd, "caption"),
      credit: str(fd, "credit"),
      folderId: str(fd, "folderId"),
    });
  } catch (e) {
    return toFormError(e);
  }
  revalidatePath("/admin/media");
  redirect("/admin/media");
}

export async function deleteMediaAction(id: string): Promise<FormState> {
  try {
    await assertSameOrigin();
    await mediaService.softDelete(await getServiceContext(), id);
  } catch (e) {
    return toFormError(e);
  }
  revalidatePath("/admin/media");
  return { ok: true };
}

export async function restoreMediaAction(id: string): Promise<FormState> {
  try {
    await assertSameOrigin();
    await mediaService.restore(await getServiceContext(), id);
  } catch (e) {
    return toFormError(e);
  }
  revalidatePath("/admin/media");
  return { ok: true };
}
