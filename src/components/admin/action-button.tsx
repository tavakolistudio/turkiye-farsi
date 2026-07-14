"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, type ButtonProps } from "@/components/ui/button";
import type { FormState } from "@/lib/forms";

/** Runs a bound (id) => FormState Server Action, then refreshes the route. */
export function ActionButton({
  id,
  action,
  children,
  confirmText,
  ...buttonProps
}: {
  id: string;
  action: (id: string) => Promise<FormState>;
  children: React.ReactNode;
  confirmText?: string;
} & ButtonProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        {...buttonProps}
        onClick={() => {
          if (confirmText && !confirm(confirmText)) return;
          setErr(null);
          start(async () => {
            const res = await action(id);
            if (res?.error) setErr(res.error);
            else router.refresh();
          });
        }}
      >
        {children}
      </Button>
      {err && <span className="text-xs text-destructive">{err}</span>}
    </>
  );
}
