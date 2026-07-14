"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import type { FormState } from "@/lib/forms";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

export interface CategoryFormValues {
  id?: string;
  name?: string;
  slug?: string;
  description?: string | null;
  parentId?: string | null;
  order?: number;
  isActive?: boolean;
  metaTitle?: string | null;
  metaDescription?: string | null;
}

export function CategoryForm({
  action,
  parents,
  initial = {},
}: {
  action: Action;
  parents: { id: string; name: string }[];
  initial?: CategoryFormValues;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});

  return (
    <form action={formAction} className="max-w-xl space-y-4" noValidate>
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      {state.error && <Alert variant="error">{state.error}</Alert>}

      <Field label="نام" name="name" error={state.fieldErrors?.name}>
        <Input id="name" name="name" defaultValue={initial.name} required />
      </Field>

      <Field label="نامک (اختیاری)" name="slug" error={state.fieldErrors?.slug}>
        <Input id="slug" name="slug" dir="ltr" defaultValue={initial.slug} placeholder="به‌صورت خودکار ساخته می‌شود" />
      </Field>

      <Field label="توضیح" name="description">
        <Textarea id="description" name="description" defaultValue={initial.description ?? ""} />
      </Field>

      <Field label="دسته‌بندی والد" name="parentId">
        <Select id="parentId" name="parentId" defaultValue={initial.parentId ?? ""}>
          <option value="">— بدون والد —</option>
          {parents
            .filter((p) => p.id !== initial.id)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </Select>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="ترتیب" name="order">
          <Input id="order" name="order" type="number" min={0} defaultValue={initial.order ?? 0} />
        </Field>
        <label className="mt-7 flex items-center gap-2 text-sm">
          <input type="checkbox" name="isActive" defaultChecked={initial.isActive ?? true} />
          فعال
        </label>
      </div>

      <Field label="عنوان متا (SEO)" name="metaTitle">
        <Input id="metaTitle" name="metaTitle" defaultValue={initial.metaTitle ?? ""} />
      </Field>
      <Field label="توضیحات متا (SEO)" name="metaDescription" error={state.fieldErrors?.metaDescription}>
        <Textarea id="metaDescription" name="metaDescription" defaultValue={initial.metaDescription ?? ""} />
      </Field>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "در حال ذخیره…" : "ذخیره"}
        </Button>
        <Link href="/admin/categories" className={buttonVariants({ variant: "outline" })}>
          انصراف
        </Link>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  error,
  children,
}: {
  label: string;
  name: string;
  error?: string[];
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      {children}
      {error && <p className="mt-1 text-xs text-destructive">{error[0]}</p>}
    </div>
  );
}
