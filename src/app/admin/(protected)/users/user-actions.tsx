"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deactivateUserAction,
  activateUserAction,
  revokeUserSessionsAction,
} from "@/server/users/actions";
import { Button } from "@/components/ui/button";

export function UserActions({
  userId,
  isActive,
  isSelf,
}: {
  userId: string;
  isActive: boolean;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string; revokedSessions?: number }>) {
    setMsg(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setMsg(res.error ?? "خطا در انجام عملیات");
      else if (typeof res.revokedSessions === "number")
        setMsg(`${res.revokedSessions} نشست بسته شد.`);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {isActive ? (
        <Button
          size="sm"
          variant="destructive"
          disabled={pending || isSelf}
          title={isSelf ? "نمی‌توانید حساب خود را غیرفعال کنید" : undefined}
          onClick={() => run(() => deactivateUserAction(userId))}
        >
          غیرفعال کردن
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => run(() => activateUserAction(userId))}
        >
          فعال کردن
        </Button>
      )}
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => run(() => revokeUserSessionsAction(userId))}
      >
        بستن نشست‌ها
      </Button>
      {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
    </div>
  );
}
