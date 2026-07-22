"use server";

import { revalidatePath } from "next/cache";
import { assertSameOrigin } from "@/server/security/csrf";
import { getServiceContext } from "@/server/services/session-context";
import { newsroomService } from "@/server/newsroom/newsroom.service";
import { toFormError, str, bool, type FormState } from "@/lib/forms";
import { DEFAULT_SCORING_WEIGHTS } from "@/server/newsroom/settings";

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

export async function cleanupAction(dryRun: boolean): Promise<FormState> {
  try {
    await assertSameOrigin();
    const ctx = await getServiceContext();
    const r = await newsroomService.cleanup(ctx, dryRun);
    const msg = dryRun
      ? `پیش‌نمایش: ${r.rejectedItemsReviewed} آیتم ردشده و ${r.jobLogsArchived} لاگ مشمول پاک‌سازی (قدیمی‌تر از ${r.retentionDays} روز).`
      : r.locked
        ? `انجام شد: ${r.rejectedItemsSoftDeleted} آیتم حذف نرم، ${r.jobLogsArchived} لاگ آرشیو.`
        : "یک پاک‌سازی دیگر در حال اجراست.";
    if (!dryRun) revalidatePath("/admin/newsroom");
    return { ok: true, message: msg };
  } catch (e) {
    return toFormError(e);
  }
}

export async function mergeClustersAction(clusterIds: string[], primaryId: string): Promise<FormState> {
  try {
    await assertSameOrigin();
    const ctx = await getServiceContext();
    const r = await newsroomService.mergeClusters(ctx, { clusterIds, primaryId });
    revalidatePath("/admin/newsroom/clusters");
    return { ok: true, message: `${r.mergedCount} خوشه ادغام شد (${r.memberCount} آیتم).` };
  } catch (e) {
    return toFormError(e);
  }
}

export async function splitClusterAction(clusterId: string, itemIds: string[]): Promise<FormState> {
  try {
    await assertSameOrigin();
    const ctx = await getServiceContext();
    const r = await newsroomService.splitCluster(ctx, { clusterId, itemIds });
    revalidatePath("/admin/newsroom/clusters");
    revalidatePath(`/admin/newsroom/clusters/${clusterId}`);
    return { ok: true, message: `${r.movedCount} آیتم به خوشه جدید منتقل شد.` };
  } catch (e) {
    return toFormError(e);
  }
}

export async function reprocessItemAction(id: string): Promise<FormState> {
  try {
    await assertSameOrigin();
    const ctx = await getServiceContext();
    const r = await newsroomService.reprocessItem(ctx, id);
    revalidatePath("/admin/newsroom");
    return { ok: true, message: `بازپردازش شد — امتیاز: ${r.finalScore ?? "—"}` };
  } catch (e) {
    return toFormError(e);
  }
}

export async function regenerateDraftAction(id: string, force = false): Promise<FormState> {
  try {
    await assertSameOrigin();
    const ctx = await getServiceContext();
    await newsroomService.regenerateDraft(ctx, id, { force });
    revalidatePath("/admin/newsroom");
    return { ok: true, message: "پیش‌نویس بازتولید شد." };
  } catch (e) {
    return toFormError(e);
  }
}

const WEIGHT_KEYS = Object.keys(DEFAULT_SCORING_WEIGHTS) as (keyof typeof DEFAULT_SCORING_WEIGHTS)[];

export async function saveSettingsAction(_prev: FormState, fd: FormData): Promise<FormState> {
  try {
    await assertSameOrigin();
    const ctx = await getServiceContext();
    const num = (k: string) => str(fd, k);
    const scoringWeights = Object.fromEntries(
      WEIGHT_KEYS.map((k) => [k, num(`w_${k}`) ?? DEFAULT_SCORING_WEIGHTS[k]]),
    );
    await newsroomService.updateSettings(ctx, {
      isEnabled: bool(fd, "isEnabled"),
      collectionEnabled: bool(fd, "collectionEnabled"),
      aiEnabled: bool(fd, "aiEnabled"),
      draftGenerationEnabled: bool(fd, "draftGenerationEnabled"),
      maxSourcesPerRun: num("maxSourcesPerRun"),
      maxItemsPerSource: num("maxItemsPerSource"),
      maxDraftsPerRun: num("maxDraftsPerRun"),
      minScoreForAI: num("minScoreForAI"),
      minScoreForDraft: num("minScoreForDraft"),
      dailyAiBudget: num("dailyAiBudget"),
      fetchTimeout: num("fetchTimeout"),
      retryCount: num("retryCount"),
      retentionDays: num("retentionDays"),
      scoringWeights,
    });
    revalidatePath("/admin/newsroom/settings");
    revalidatePath("/admin/newsroom");
    return { ok: true, message: "تنظیمات ذخیره شد." };
  } catch (e) {
    return toFormError(e);
  }
}

export async function resetSettingsAction(): Promise<FormState> {
  try {
    await assertSameOrigin();
    const ctx = await getServiceContext();
    await newsroomService.resetSettings(ctx);
    revalidatePath("/admin/newsroom/settings");
    return { ok: true, message: "به پیش‌فرض بازنشانی شد." };
  } catch (e) {
    return toFormError(e);
  }
}

export async function saveSourceCollectionAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const id = str(fd, "id");
  try {
    await assertSameOrigin();
    const ctx = await getServiceContext();
    if (!id) throw new Error("missing id");
    await newsroomService.updateSourceCollection(ctx, id, {
      feedUrl: str(fd, "feedUrl") ?? "",
      collectionMethod: str(fd, "collectionMethod") ?? "MANUAL",
      trustLevel: str(fd, "trustLevel") ?? "50",
      priority: str(fd, "priority") ?? "0",
      isEnabled: bool(fd, "isEnabled"),
      fetchIntervalMinutes: str(fd, "fetchIntervalMinutes") ?? "1440",
      maxExcerptLength: str(fd, "maxExcerptLength") ?? "400",
      allowFullTextFetch: bool(fd, "allowFullTextFetch"),
    });
    revalidatePath("/admin/newsroom/sources");
    return { ok: true, message: "منبع ذخیره شد." };
  } catch (e) {
    return toFormError(e);
  }
}

export async function toggleSourceAction(id: string, enabled: boolean): Promise<FormState> {
  try {
    await assertSameOrigin();
    const ctx = await getServiceContext();
    await newsroomService.toggleSourceEnabled(ctx, id, enabled);
    revalidatePath("/admin/newsroom/sources");
    return { ok: true };
  } catch (e) {
    return toFormError(e);
  }
}

export async function testFeedAction(feedUrl: string): Promise<FormState & { result?: unknown }> {
  try {
    await assertSameOrigin();
    const ctx = await getServiceContext();
    const result = await newsroomService.testFeed(ctx, { feedUrl });
    return { ok: result.ok, result, message: result.ok ? `${result.itemCount} آیتم یافت شد.` : result.error?.message };
  } catch (e) {
    return toFormError(e);
  }
}
