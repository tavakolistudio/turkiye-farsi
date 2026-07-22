"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import type { FormState } from "@/lib/forms";
import { cleanupAction } from "../actions";

/** Retention cleanup controls: dry-run (safe) and real run. */
export function CleanupCard({ canRun, retentionDays }: { canRun: boolean; retentionDays: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<FormState | null>(null);

  function run(dryRun: boolean) {
    if (!dryRun && !confirm("پاک‌سازی واقعی انجام شود؟ آیتم‌های ردشده قدیمی حذف نرم و لاگ‌های قدیمی آرشیو می‌شوند.")) return;
    start(async () => {
      const r = await cleanupAction(dryRun);
      setMsg(r);
      if (r.ok && !dryRun) router.refresh();
    });
  }

  return (
    <Card className="space-y-3 p-4">
      <div>
        <h2 className="font-semibold">پاک‌سازی نگهداری (Retention)</h2>
        <p className="text-sm text-muted-foreground">
          آیتم‌های ردشده و لاگ‌های قدیمی‌تر از {retentionDays} روز. پیش‌نویس‌ها، منابع و Audit حذف نمی‌شوند.
        </p>
      </div>
      {msg?.message && <Alert variant={msg.ok ? "success" : "error"}>{msg.message}</Alert>}
      {canRun && (
        <div className="flex gap-2">
          <Button type="button" variant="outline" disabled={pending} onClick={() => run(true)}>
            پیش‌نمایش (Dry-run)
          </Button>
          <Button type="button" variant="outline" disabled={pending} onClick={() => run(false)}>
            اجرای پاک‌سازی
          </Button>
        </div>
      )}
    </Card>
  );
}
