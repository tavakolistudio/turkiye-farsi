"use client";

import { useActionState } from "react";
import { changePasswordAction, type ActionState } from "@/server/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";

export function ChangePasswordForm() {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    changePasswordAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.error && <Alert variant="error">{state.error}</Alert>}

      <div>
        <Label htmlFor="currentPassword">رمز عبور فعلی</Label>
        <Input id="currentPassword" name="currentPassword" type="password" dir="ltr" autoComplete="current-password" required />
        {state.fieldErrors?.currentPassword && (
          <p className="mt-1 text-xs text-destructive">{state.fieldErrors.currentPassword[0]}</p>
        )}
      </div>

      <div>
        <Label htmlFor="newPassword">رمز عبور جدید</Label>
        <Input id="newPassword" name="newPassword" type="password" dir="ltr" autoComplete="new-password" required />
        {state.fieldErrors?.newPassword && (
          <p className="mt-1 text-xs text-destructive">{state.fieldErrors.newPassword[0]}</p>
        )}
      </div>

      <div>
        <Label htmlFor="confirmPassword">تکرار رمز عبور جدید</Label>
        <Input id="confirmPassword" name="confirmPassword" type="password" dir="ltr" autoComplete="new-password" required />
        {state.fieldErrors?.confirmPassword && (
          <p className="mt-1 text-xs text-destructive">{state.fieldErrors.confirmPassword[0]}</p>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        پس از تغییر رمز، همه نشست‌های شما بسته می‌شود و باید دوباره وارد شوید.
      </p>

      <Button type="submit" disabled={isPending}>
        {isPending ? "در حال ثبت..." : "تغییر رمز عبور"}
      </Button>
    </form>
  );
}
