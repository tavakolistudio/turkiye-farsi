"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { updateMediaMetaAction } from "../../actions";
import type { FormState } from "@/lib/forms";

export function MediaMetaForm({
  initial,
}: {
  initial: { id: string; alt?: string | null; caption?: string | null; credit?: string | null };
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(updateMediaMetaAction, {});
  return (
    <form action={formAction} className="max-w-xl space-y-4" noValidate>
      <input type="hidden" name="id" value={initial.id} />
      {state.error && <Alert variant="error">{state.error}</Alert>}
      <div>
        <Label htmlFor="alt">متن جایگزین (Alt)</Label>
        <Input id="alt" name="alt" defaultValue={initial.alt ?? ""} />
      </div>
      <div>
        <Label htmlFor="caption">توضیح (Caption)</Label>
        <Textarea id="caption" name="caption" defaultValue={initial.caption ?? ""} />
      </div>
      <div>
        <Label htmlFor="credit">اعتبار/منبع تصویر</Label>
        <Input id="credit" name="credit" defaultValue={initial.credit ?? ""} />
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>{pending ? "در حال ذخیره…" : "ذخیره"}</Button>
        <Link href="/admin/media" className={buttonVariants({ variant: "outline" })}>انصراف</Link>
      </div>
    </form>
  );
}
