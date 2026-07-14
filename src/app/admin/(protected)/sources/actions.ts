"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertSameOrigin } from "@/server/security/csrf";
import { getServiceContext } from "@/server/services/session-context";
import { sourceService } from "@/server/services/source.service";
import { toFormError, str, bool, type FormState } from "@/lib/forms";

function payload(fd: FormData) {
  return {
    name: str(fd, "name"),
    slug: str(fd, "slug"),
    websiteUrl: str(fd, "websiteUrl"),
    country: str(fd, "country"),
    language: str(fd, "language"),
    sourceType: str(fd, "sourceType"),
    credibilityLevel: str(fd, "credibilityLevel"),
    isOfficial: bool(fd, "isOfficial"),
    isActive: bool(fd, "isActive"),
    description: str(fd, "description"),
  };
}

export async function createSourceAction(_prev: FormState, fd: FormData): Promise<FormState> {
  try {
    await assertSameOrigin();
    await sourceService.create(await getServiceContext(), payload(fd));
  } catch (e) {
    return toFormError(e);
  }
  revalidatePath("/admin/sources");
  redirect("/admin/sources");
}

export async function updateSourceAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const id = str(fd, "id");
  try {
    await assertSameOrigin();
    if (!id) throw new Error("missing id");
    await sourceService.update(await getServiceContext(), id, payload(fd));
  } catch (e) {
    return toFormError(e);
  }
  revalidatePath("/admin/sources");
  redirect("/admin/sources");
}

export async function deleteSourceAction(id: string): Promise<FormState> {
  try {
    await assertSameOrigin();
    await sourceService.softDelete(await getServiceContext(), id);
  } catch (e) {
    return toFormError(e);
  }
  revalidatePath("/admin/sources");
  return { ok: true };
}

export async function restoreSourceAction(id: string): Promise<FormState> {
  try {
    await assertSameOrigin();
    await sourceService.restore(await getServiceContext(), id);
  } catch (e) {
    return toFormError(e);
  }
  revalidatePath("/admin/sources");
  return { ok: true };
}

export async function verifySourceAction(id: string): Promise<FormState> {
  try {
    await assertSameOrigin();
    await sourceService.verify(await getServiceContext(), id);
  } catch (e) {
    return toFormError(e);
  }
  revalidatePath("/admin/sources");
  return { ok: true };
}
