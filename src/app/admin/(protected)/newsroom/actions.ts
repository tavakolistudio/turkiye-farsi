"use server";

import { revalidatePath } from "next/cache";
import { assertSameOrigin } from "@/server/security/csrf";
import { getServiceContext } from "@/server/services/session-context";
import { newsroomService } from "@/server/newsroom/newsroom.service";
import { toFormError, type FormState } from "@/lib/forms";

export async function runCollectionAction(): Promise<FormState> {
  try {
    await assertSameOrigin();
    const ctx = await getServiceContext();
    const r = await newsroomService.run(ctx, "manual");
    revalidatePath("/admin/newsroom");
    const msg = r.skipped
      ? r.skipped === "disabled"
        ? "جمع‌آوری غیرفعال است (Kill Switch)."
        : "یک اجرا هم‌اکنون در جریان است."
      : `اجرا کامل شد: ${r.newCount} خبر تازه، ${r.duplicateCount} تکراری، ${r.failedCount} خطا.`;
    return { ok: true, message: msg };
  } catch (e) {
    return toFormError(e);
  }
}

export async function createDraftAction(id: string): Promise<FormState> {
  try {
    await assertSameOrigin();
    const ctx = await getServiceContext();
    const { slug } = await newsroomService.createDraftFromItem(ctx, id);
    revalidatePath("/admin/newsroom");
    return { ok: true, message: `پیش‌نویس ساخته شد: ${slug}` };
  } catch (e) {
    return toFormError(e);
  }
}

export async function rejectItemAction(id: string): Promise<FormState> {
  try {
    await assertSameOrigin();
    const ctx = await getServiceContext();
    await newsroomService.reject(ctx, id);
    revalidatePath("/admin/newsroom");
    return { ok: true };
  } catch (e) {
    return toFormError(e);
  }
}
