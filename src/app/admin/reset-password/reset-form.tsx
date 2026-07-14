"use client";

import { useActionState } from "react";
import { resetPasswordAction, type ActionState } from "@/server/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";

export function ResetForm({ token }: { token: string }) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    resetPasswordAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="token" value={token} />
      {state.error && <Alert variant="error">{state.error}</Alert>}

      <div>
        <Label htmlFor="password">رمز عبور جدید</Label>
        <Input id="password" name="password" type="password" dir="ltr" autoComplete="new-password" required />
        {state.fieldErrors?.password && (
          <p className="mt-1 text-xs text-destructive">{state.fieldErrors.password[0]}</p>
        )}
      </div>

      <div>
        <Label htmlFor="confirmPassword">تکرار رمز عبور</Label>
        <Input id="confirmPassword" name="confirmPassword" type="password" dir="ltr" autoComplete="new-password" required />
        {state.fieldErrors?.confirmPassword && (
          <p className="mt-1 text-xs text-destructive">{state.fieldErrors.confirmPassword[0]}</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "در حال ثبت..." : "تغییر رمز عبور"}
      </Button>
    </form>
  );
}
