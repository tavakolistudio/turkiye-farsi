"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/forms";

type ActionFn = (id: string) => Promise<FormState>;

/**
 * Permission-aware soft-delete / restore buttons for a table row. The delete
 * and restore Server Actions are passed in (bound per model). Authorization is
 * still enforced server-side inside those actions.
 */
export function RowActions({
  id,
  deleted,
  onDelete,
  onRestore,
  canDelete,
  canRestore,
}: {
  id: string;
  deleted: boolean;
  onDelete?: ActionFn;
  onRestore?: ActionFn;
  canDelete?: boolean;
  canRestore?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function run(fn: ActionFn) {
    setErr(null);
    start(async () => {
      const res = await fn(id);
      if (res?.error) setErr(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {!deleted && canDelete && onDelete && (
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => {
            if (confirm("این مورد حذف (نرم) شود؟")) run(onDelete);
          }}
        >
          حذف
        </Button>
      )}
      {deleted && canRestore && onRestore && (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(onRestore)}>
          بازیابی
        </Button>
      )}
      {err && <span className="text-xs text-destructive">{err}</span>}
    </div>
  );
}
