"use client";

import { useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import type { FormState } from "@/lib/forms";
import type { NewsroomSettings } from "@/server/newsroom/settings";
import { saveSettingsAction, resetSettingsAction } from "../actions";

const WEIGHT_LABELS: Record<string, string> = {
  relevanceToIraniansInTurkey: "ارتباط با ایرانیان در ترکیه",
  legalImpact: "اثر حقوقی",
  financialImpact: "اثر مالی",
  urgency: "فوریت",
  geographicRelevance: "ارتباط جغرافیایی",
  sourceAuthority: "اعتبار منبع",
  multiSourceConfirmation: "تأیید چندمنبع",
  novelty: "تازگی",
  publicSafety: "ایمنی عمومی",
  actionability: "قابلیت اقدام",
  viralityPotential: "پتانسیل وایرال",
  longTermImportance: "اهمیت بلندمدت",
};

export function SettingsForm({ initial, canEdit }: { initial: NewsroomSettings; canEdit: boolean }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(saveSettingsAction, {});
  const router = useRouter();
  const [resetting, startReset] = useTransition();
  const weightSum = Object.values(initial.scoringWeights).reduce((a, b) => a + b, 0);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.error && <Alert variant="error">{state.error}</Alert>}
      {state.ok && state.message && <Alert variant="success">{state.message}</Alert>}
      {!canEdit && <Alert variant="warning">شما فقط اجازه مشاهده دارید.</Alert>}

      <Card className="space-y-3 p-4">
        <h2 className="font-semibold">کلیدهای اصلی (Kill Switch)</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <Toggle name="isEnabled" label="اتاق خبر فعال" defaultChecked={initial.isEnabled} disabled={!canEdit} />
          <Toggle name="collectionEnabled" label="جمع‌آوری فعال" defaultChecked={initial.collectionEnabled} disabled={!canEdit} />
          <Toggle name="aiEnabled" label="هوش مصنوعی فعال" defaultChecked={initial.aiEnabled} disabled={!canEdit} />
          <Toggle name="draftGenerationEnabled" label="تولید Draft خودکار" defaultChecked={initial.draftGenerationEnabled} disabled={!canEdit} />
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <h2 className="font-semibold">محدودیت‌های اجرا</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Num name="maxSourcesPerRun" label="حداکثر منبع در هر اجرا" v={initial.maxSourcesPerRun} disabled={!canEdit} />
          <Num name="maxItemsPerSource" label="حداکثر آیتم هر منبع" v={initial.maxItemsPerSource} disabled={!canEdit} />
          <Num name="maxDraftsPerRun" label="حداکثر Draft هر اجرا" v={initial.maxDraftsPerRun} disabled={!canEdit} />
          <Num name="minScoreForAI" label="حداقل امتیاز برای AI" v={initial.minScoreForAI} disabled={!canEdit} />
          <Num name="minScoreForDraft" label="حداقل امتیاز برای Draft" v={initial.minScoreForDraft} disabled={!canEdit} />
          <Num name="dailyAiBudget" label="بودجه روزانه AI (دلار)" v={initial.dailyAiBudget} step="0.1" disabled={!canEdit} />
          <Num name="fetchTimeout" label="Timeout دریافت (ms)" v={initial.fetchTimeout} disabled={!canEdit} />
          <Num name="retryCount" label="تعداد تلاش مجدد" v={initial.retryCount} disabled={!canEdit} />
          <Num name="retentionDays" label="نگهداری (روز)" v={initial.retentionDays} disabled={!canEdit} />
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">وزن‌های امتیازدهی</h2>
          <span className={`text-sm ${weightSum === 100 ? "text-muted-foreground" : "text-warning"}`}>
            مجموع: {weightSum} {weightSum !== 100 && "(توصیه: ۱۰۰)"}
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {Object.entries(initial.scoringWeights).map(([k, v]) => (
            <Num key={k} name={`w_${k}`} label={WEIGHT_LABELS[k] ?? k} v={v} disabled={!canEdit} />
          ))}
        </div>
      </Card>

      {canEdit && (
        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "در حال ذخیره…" : "ذخیره تنظیمات"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={resetting}
            onClick={() => {
              if (confirm("بازنشانی به پیش‌فرض؟ (جمع‌آوری و AI خاموش می‌شوند)"))
                startReset(async () => {
                  await resetSettingsAction();
                  router.refresh();
                });
            }}
          >
            بازنشانی به پیش‌فرض
          </Button>
        </div>
      )}
    </form>
  );
}

function Toggle({ name, label, defaultChecked, disabled }: { name: string; label: string; defaultChecked: boolean; disabled?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} disabled={disabled} />
      {label}
    </label>
  );
}

function Num({ name, label, v, step, disabled }: { name: string; label: string; v: number; step?: string; disabled?: boolean }) {
  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type="number" step={step} defaultValue={v} disabled={disabled} dir="ltr" />
    </div>
  );
}
