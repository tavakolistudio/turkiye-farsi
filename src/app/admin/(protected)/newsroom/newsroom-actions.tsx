"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { runCollectionAction, createDraftAction, rejectItemAction, reprocessItemAction, regenerateDraftAction } from "./actions";
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

/** Per-item actions: create draft / reject / reprocess / regenerate. */
export function ItemActions({
  id,
  status,
  canDraft,
  canReject,
  canReprocess,
  canRegenerate,
}: {
  id: string;
  status: string;
  canDraft: boolean;
  canReject: boolean;
  canReprocess: boolean;
  canRegenerate: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<FormState | null>(null);
  const isDrafted = status === "DRAFTED";

  function run(fn: (id: string) => Promise<FormState>) {
    start(async () => {
      const r = await fn(id);
      setResult(r);
      if (r.ok) router.refresh();
    });
  }

  function regenerate() {
    start(async () => {
      let r = await regenerateDraftAction(id, false);
      // If the draft was human-edited (409/conflict), confirm a forced rewrite.
      if (!r.ok && r.error && confirm("این پیش‌نویس ویرایش انسانی دارد. بازنویسی اجباری انجام شود؟")) {
        r = await regenerateDraftAction(id, true);
      }
      setResult(r);
      if (r.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {canDraft && !isDrafted && (
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run(createDraftAction)}>
            ساخت پیش‌نویس
          </Button>
        )}
        {canRegenerate && isDrafted && (
          <Button size="sm" variant="outline" disabled={pending} onClick={regenerate}>
            بازتولید پیش‌نویس
          </Button>
        )}
        {canReprocess && (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(reprocessItemAction)}>
            بازپردازش
          </Button>
        )}
        {canReject && !isDrafted && (
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
