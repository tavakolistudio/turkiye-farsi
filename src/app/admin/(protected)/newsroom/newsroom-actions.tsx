"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { runCollectionAction, createDraftAction, rejectItemAction } from "./actions";
import type { FormState } from "@/lib/forms";

/** "Run collection now" button (permission enforced server-side). */
export function RunCollectionButton({ canRun }: { canRun: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<FormState | null>(null);
  if (!canRun) return null;
  return (
    <div className="flex items-center gap-3">
      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setMsg(await runCollectionAction());
            router.refresh();
          })
        }
      >
        {pending ? "در حال اجرا…" : "اجرای جمع‌آوری"}
      </Button>
      {msg?.message && <span className="text-sm text-muted-foreground">{msg.message}</span>}
      {msg?.error && <span className="text-sm text-destructive">{msg.error}</span>}
    </div>
  );
}

/** Per-item "create draft" / "reject" actions. */
export function ItemActions({
  id,
  canDraft,
  canReject,
}: {
  id: string;
  canDraft: boolean;
  canReject: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<FormState | null>(null);

  function run(fn: (id: string) => Promise<FormState>) {
    start(async () => {
      const r = await fn(id);
      setResult(r);
      if (r.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {canDraft && (
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run(createDraftAction)}>
            ساخت پیش‌نویس
          </Button>
        )}
        {canReject && (
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              if (confirm("این خبر رد شود؟")) run(rejectItemAction);
            }}
          >
            رد
          </Button>
        )}
      </div>
      {result?.ok && result.message && <Alert variant="success">{result.message}</Alert>}
      {result?.error && <Alert variant="error">{result.error}</Alert>}
    </div>
  );
}
