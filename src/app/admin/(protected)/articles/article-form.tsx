"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { CONTENT_TYPES, CONTENT_TYPE_LABELS, ARTICLE_STATUSES, ARTICLE_STATUS_LABELS } from "@/lib/content-enums";
import type { FormState } from "@/lib/forms";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;
type Opt = { id: string; name: string };

export interface ArticleFormValues {
  id?: string;
  title?: string;
  slug?: string;
  subtitle?: string | null;
  summary?: string | null;
  body?: string;
  contentType?: string;
  status?: string;
  primaryCategoryId?: string | null;
  authorId?: string;
  featuredImageId?: string | null;
  tagIds?: string[];
  sourceId?: string;
  metaTitle?: string | null;
  metaDescription?: string | null;
  canonicalUrl?: string | null;
  noindex?: boolean;
}

export function ArticleForm({
  action,
  options,
  initial = {},
}: {
  action: Action;
  options: { categories: Opt[]; tags: Opt[]; authors: Opt[]; media: Opt[]; sources: Opt[] };
  initial?: ArticleFormValues;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="grid max-w-3xl gap-4" noValidate>
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      {state.error && <Alert variant="error">{state.error}</Alert>}

      <div>
        <Label htmlFor="title">عنوان</Label>
        <Input id="title" name="title" defaultValue={initial.title} required />
        {fe.title && <p className="mt-1 text-xs text-destructive">{fe.title[0]}</p>}
      </div>

      <div>
        <Label htmlFor="slug">نامک (اختیاری)</Label>
        <Input id="slug" name="slug" dir="ltr" defaultValue={initial.slug} placeholder="خودکار از عنوان" />
        {fe.slug && <p className="mt-1 text-xs text-destructive">{fe.slug[0]}</p>}
      </div>

      <div>
        <Label htmlFor="subtitle">زیرعنوان</Label>
        <Input id="subtitle" name="subtitle" defaultValue={initial.subtitle ?? ""} />
      </div>

      <div>
        <Label htmlFor="summary">خلاصه</Label>
        <Textarea id="summary" name="summary" defaultValue={initial.summary ?? ""} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="contentType">نوع محتوا</Label>
          <Select id="contentType" name="contentType" defaultValue={initial.contentType ?? "NEWS"}>
            {CONTENT_TYPES.map((t) => (
              <option key={t} value={t}>{CONTENT_TYPE_LABELS[t]}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="status">وضعیت</Label>
          <Select id="status" name="status" defaultValue={initial.status ?? "DRAFT"}>
            {ARTICLE_STATUSES.map((s) => (
              <option key={s} value={s}>{ARTICLE_STATUS_LABELS[s]}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="primaryCategoryId">دسته‌بندی اصلی</Label>
          <Select id="primaryCategoryId" name="primaryCategoryId" defaultValue={initial.primaryCategoryId ?? ""}>
            <option value="">— بدون دسته‌بندی —</option>
            {options.categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="authorId">نویسنده</Label>
          <Select id="authorId" name="authorId" defaultValue={initial.authorId ?? ""}>
            <option value="">— خودم —</option>
            {options.authors.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="featuredImageId">تصویر شاخص</Label>
          <Select id="featuredImageId" name="featuredImageId" defaultValue={initial.featuredImageId ?? ""}>
            <option value="">— بدون تصویر —</option>
            {options.media.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="sourceId">منبع اصلی</Label>
          <Select id="sourceId" name="sourceId" defaultValue={initial.sourceId ?? ""}>
            <option value="">— بدون منبع —</option>
            {options.sources.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="tagIds">برچسب‌ها (چند انتخابی)</Label>
        <select
          id="tagIds"
          name="tagIds"
          multiple
          defaultValue={initial.tagIds ?? []}
          className="min-h-28 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
        >
          {options.tags.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      <div>
        <Label htmlFor="body">متن (پاراگراف‌ها با یک خط خالی جدا شوند)</Label>
        <Textarea id="body" name="body" defaultValue={initial.body ?? ""} className="min-h-40" />
        <p className="mt-1 text-xs text-muted-foreground">ویرایشگر کامل TipTap در فاز بعد اضافه می‌شود.</p>
      </div>

      <fieldset className="rounded-lg border border-border p-4">
        <legend className="px-2 text-sm font-medium">سئو</legend>
        <div className="space-y-3">
          <div>
            <Label htmlFor="metaTitle">عنوان متا</Label>
            <Input id="metaTitle" name="metaTitle" defaultValue={initial.metaTitle ?? ""} />
          </div>
          <div>
            <Label htmlFor="metaDescription">توضیحات متا</Label>
            <Textarea id="metaDescription" name="metaDescription" defaultValue={initial.metaDescription ?? ""} />
            {fe.metaDescription && <p className="mt-1 text-xs text-destructive">{fe.metaDescription[0]}</p>}
          </div>
          <div>
            <Label htmlFor="canonicalUrl">Canonical URL</Label>
            <Input id="canonicalUrl" name="canonicalUrl" dir="ltr" defaultValue={initial.canonicalUrl ?? ""} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="noindex" defaultChecked={initial.noindex ?? false} /> noindex
          </label>
        </div>
      </fieldset>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>{pending ? "در حال ذخیره…" : "ذخیره"}</Button>
        <Link href="/admin/articles" className={buttonVariants({ variant: "outline" })}>انصراف</Link>
      </div>
    </form>
  );
}
