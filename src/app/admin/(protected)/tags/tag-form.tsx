"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import type { FormState } from "@/lib/forms";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

export function TagForm({
  action,
  initial = {},
}: {
  action: Action;
  initial?: { id?: string; name?: string; slug?: string; description?: string | null };
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});

  return (
    <form action={formAction} className="max-w-xl space-y-4" noValidate>
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      {state.error && <Alert variant="error">{state.error}</Alert>}

      <div>
        <Label htmlFor="name">نام برچسب</Label>
        <Input id="name" name="name" defaultValue={initial.name} required />
        {state.fieldErrors?.name && <p className="mt-1 text-xs text-destructive">{state.fieldErrors.name[0]}</p>}
      </div>
      <div>
        <Label htmlFor="slug">نامک (اختیاری)</Label>
        <Input id="slug" name="slug" dir="ltr" defaultValue={initial.slug} />
      </div>
      <div>
        <Label htmlFor="description">توضیح</Label>
        <Textarea id="description" name="description" defaultValue={initial.description ?? ""} />
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "در حال ذخیره…" : "ذخیره"}
        </Button>
        <Link href="/admin/tags" className={buttonVariants({ variant: "outline" })}>
          انصراف
        </Link>
      </div>
    </form>
  );
}
