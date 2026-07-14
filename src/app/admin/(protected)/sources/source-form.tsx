"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { SOURCE_TYPES, SOURCE_TYPE_LABELS, CREDIBILITY_LEVELS, CREDIBILITY_LABELS } from "@/lib/content-enums";
import type { FormState } from "@/lib/forms";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

export interface SourceFormValues {
  id?: string;
  name?: string;
  slug?: string;
  websiteUrl?: string | null;
  country?: string | null;
  language?: string | null;
  sourceType?: string;
  credibilityLevel?: string;
  isOfficial?: boolean;
  isActive?: boolean;
  description?: string | null;
}

export function SourceForm({ action, initial = {} }: { action: Action; initial?: SourceFormValues }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});

  return (
    <form action={formAction} className="max-w-xl space-y-4" noValidate>
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      {state.error && <Alert variant="error">{state.error}</Alert>}

      <div>
        <Label htmlFor="name">نام منبع</Label>
        <Input id="name" name="name" defaultValue={initial.name} required />
        {state.fieldErrors?.name && <p className="mt-1 text-xs text-destructive">{state.fieldErrors.name[0]}</p>}
      </div>
      <div>
        <Label htmlFor="slug">نامک (اختیاری)</Label>
        <Input id="slug" name="slug" dir="ltr" defaultValue={initial.slug} />
      </div>
      <div>
        <Label htmlFor="websiteUrl">وب‌سایت</Label>
        <Input id="websiteUrl" name="websiteUrl" dir="ltr" defaultValue={initial.websiteUrl ?? ""} placeholder="https://…" />
        {state.fieldErrors?.websiteUrl && (
          <p className="mt-1 text-xs text-destructive">{state.fieldErrors.websiteUrl[0]}</p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="sourceType">نوع منبع</Label>
          <Select id="sourceType" name="sourceType" defaultValue={initial.sourceType ?? "OTHER"}>
            {SOURCE_TYPES.map((t) => (
              <option key={t} value={t}>{SOURCE_TYPE_LABELS[t]}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="credibilityLevel">سطح اعتبار</Label>
          <Select id="credibilityLevel" name="credibilityLevel" defaultValue={initial.credibilityLevel ?? "MEDIUM"}>
            {CREDIBILITY_LEVELS.map((c) => (
              <option key={c} value={c}>{CREDIBILITY_LABELS[c]}</option>
            ))}
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="country">کشور</Label>
          <Input id="country" name="country" defaultValue={initial.country ?? ""} />
        </div>
        <div>
          <Label htmlFor="language">زبان</Label>
          <Input id="language" name="language" dir="ltr" defaultValue={initial.language ?? ""} placeholder="fa / tr / en" />
        </div>
      </div>
      <div className="flex gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isOfficial" defaultChecked={initial.isOfficial ?? false} /> منبع رسمی
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isActive" defaultChecked={initial.isActive ?? true} /> فعال
        </label>
      </div>
      <div>
        <Label htmlFor="description">توضیح</Label>
        <Textarea id="description" name="description" defaultValue={initial.description ?? ""} />
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "در حال ذخیره…" : "ذخیره"}
        </Button>
        <Link href="/admin/sources" className={buttonVariants({ variant: "outline" })}>
          انصراف
        </Link>
      </div>
    </form>
  );
}
