"use client";

import { useActionState } from "react";
import { forgotPasswordAction, type ActionState } from "@/server/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";

export function ForgotForm() {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    forgotPasswordAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.error && <Alert variant="error">{state.error}</Alert>}
      {state.ok && state.message && <Alert variant="success">{state.message}</Alert>}
      {state.devResetLink && (
        <Alert variant="info">
          <span className="block font-medium">لینک بازیابی (فقط محیط توسعه):</span>
          <a href={state.devResetLink} className="break-all text-primary underline" dir="ltr">
            {state.devResetLink}
          </a>
        </Alert>
      )}

      <div>
        <Label htmlFor="email">ایمیل</Label>
        <Input id="email" name="email" type="email" dir="ltr" autoComplete="username" required />
        {state.fieldErrors?.email && (
          <p className="mt-1 text-xs text-destructive">{state.fieldErrors.email[0]}</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "در حال ارسال..." : "ارسال لینک بازیابی"}
      </Button>

      <div className="text-center text-sm">
        <a href="/admin/login" className="text-primary hover:underline">
          بازگشت به ورود
        </a>
      </div>
    </form>
  );
}
