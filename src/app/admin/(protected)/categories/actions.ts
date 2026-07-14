"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertSameOrigin } from "@/server/security/csrf";
import { getServiceContext } from "@/server/services/session-context";
import { categoryService } from "@/server/services/category.service";
import { toFormError, str, bool, type FormState } from "@/lib/forms";

function payload(fd: FormData) {
  return {
    name: str(fd, "name"),
    slug: str(fd, "slug"),
    description: str(fd, "description"),
    parentId: str(fd, "parentId"),
    imageId: str(fd, "imageId"),
    order: str(fd, "order") ?? "0",
    isActive: bool(fd, "isActive"),
    metaTitle: str(fd, "metaTitle"),
    metaDescription: str(fd, "metaDescription"),
  };
}

export async function createCategoryAction(_prev: FormState, fd: FormData): Promise<FormState> {
  try {
    await assertSameOrigin();
    const ctx = await getServiceContext();
    await categoryService.create(ctx, payload(fd));
  } catch (e) {
    return toFormError(e);
  }
  revalidatePath("/admin/categories");
  redirect("/admin/categories");
}

export async function updateCategoryAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const id = str(fd, "id");
  try {
    await assertSameOrigin();
    const ctx = await getServiceContext();
    if (!id) throw new Error("missing id");
    await categoryService.update(ctx, id, payload(fd));
  } catch (e) {
    return toFormError(e);
  }
  revalidatePath("/admin/categories");
  redirect("/admin/categories");
}

export async function deleteCategoryAction(id: string): Promise<FormState> {
  try {
    await assertSameOrigin();
    const ctx = await getServiceContext();
    await categoryService.softDelete(ctx, id);
  } catch (e) {
    return toFormError(e);
  }
  revalidatePath("/admin/categories");
  return { ok: true };
}

export async function restoreCategoryAction(id: string): Promise<FormState> {
  try {
    await assertSameOrigin();
    const ctx = await getServiceContext();
    await categoryService.restore(ctx, id);
  } catch (e) {
    return toFormError(e);
  }
  revalidatePath("/admin/categories");
  return { ok: true };
}
