"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { CONTENT_TYPES, CONTENT_TYPE_LABELS } from "@/lib/content-enums";
import type { FormState } from "@/lib/forms";
import { TiptapEditor } from "@/components/editor/tiptap-editor";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;
type Opt = { id: string; name: string };

export interface ArticleFormValues {
  id?: string;
  title?: string;
  slug?: string;
  subtitle?: string | null;
  summary?: string | null;
  bodyJson?: unknown;
  currentVersion?: number;
  contentType?: string;
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
  autosave = false,
}: {
  action: Action;
  options: { categories: Opt[]; tags: Opt[]; authors: Opt[]; media: Opt[]; sources: Opt[] };
  initial?: ArticleFormValues;
  autosave?: boolean;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const fe = state.fieldErrors ?? {};
  const formRef = useRef<HTMLFormElement>(null);
  const bodyInputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<unknown>(initial.bodyJson ?? { type: "doc", content: [{ type: "paragraph" }] });
  const versionRef = useRef(initial.currentVersion ?? 0);
  const dirtyRef = useRef(false);
  const [saveState, setSaveState] = useState(autosave ? "آماده‌سازی ذخیره…" : "ذخیره‌شده");

  useEffect(() => {
    const form = formRef.current;
    if (!autosave || !initial.id || !form) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let sequence = 0;
    let controller: AbortController | undefined;

    const save = async (isRetry = false) => {
      const requestSequence = ++sequence;
      controller?.abort();
      controller = new AbortController();
      const fd = new FormData(form);
      const text = (name: string) => String(fd.get(name) ?? "").trim() || null;
      const payload = {
        version: versionRef.current,
        title: text("title"),
        subtitle: text("subtitle"),
        summary: text("summary"),
        bodyJson: bodyRef.current,
      };
      setSaveState(isRetry ? "تلاش دوباره…" : "در حال ذخیره…");
      try {
        const response = await fetch(`/api/v1/admin/articles/${initial.id}/autosave`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        const result = await response.json() as { success: boolean; data?: { currentVersion: number }; error?: { code: string; message: string } };
        if (requestSequence !== sequence) return;
        if (!response.ok || !result.success || !result.data) {
          if (result.error?.code === "VERSION_CONFLICT") {
            setSaveState("تعارض نسخه — صفحه را تازه کنید");
            return;
          }
          throw new Error(result.error?.message || "ذخیره ناموفق بود");
        }
        versionRef.current = result.data.currentVersion;
        const versionInput = form.elements.namedItem("version") as HTMLInputElement | null;
        if (versionInput) versionInput.value = String(versionRef.current);
        dirtyRef.current = false;
        setSaveState("ذخیره شد");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (!isRetry && requestSequence === sequence) {
          setSaveState("خطای شبکه — تلاش دوباره…");
          retryTimer = setTimeout(() => { if (dirtyRef.current && requestSequence === sequence) void save(true); }, 2_000);
        } else if (requestSequence === sequence) {
          setSaveState("ذخیره ناموفق — تغییرات باقی مانده‌اند");
        }
      }
    };
    const autosaveFields = new Set(["title", "subtitle", "summary", "bodyJson"]);
    const changed = (event: Event) => {
      const target = event.target as HTMLInputElement | HTMLTextAreaElement | null;
      if (!target?.name || !autosaveFields.has(target.name)) return;
      dirtyRef.current = true;
      setSaveState("تغییر ذخیره‌نشده");
      if (timer) clearTimeout(timer);
      if (retryTimer) clearTimeout(retryTimer);
      timer = setTimeout(() => void save(), 1_200);
    };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    form.addEventListener("input", changed);
    form.addEventListener("change", changed);
    window.addEventListener("beforeunload", beforeUnload);
    setSaveState("ذخیره‌شده");
    return () => {
      if (timer) clearTimeout(timer);
      if (retryTimer) clearTimeout(retryTimer);
      controller?.abort();
      form.removeEventListener("input", changed);
      form.removeEventListener("change", changed);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [autosave, initial.id]);

  return (
    <form ref={formRef} action={formAction} className="grid gap-4" noValidate>
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="version" defaultValue={initial.currentVersion ?? 0} />
      <input ref={bodyInputRef} type="hidden" name="bodyJson" defaultValue={JSON.stringify(initial.bodyJson ?? { type: "doc", content: [{ type: "paragraph" }] })} />
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

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="contentType">نوع محتوا</Label>
          <Select id="contentType" name="contentType" defaultValue={initial.contentType ?? "NEWS"}>
            {CONTENT_TYPES.map((t) => (
              <option key={t} value={t}>{CONTENT_TYPE_LABELS[t]}</option>
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
        <Label>متن مطلب</Label>
        <TiptapEditor
          value={initial.bodyJson}
          onChange={(json) => {
            bodyRef.current = json;
            if (bodyInputRef.current) {
              bodyInputRef.current.value = JSON.stringify(json);
              bodyInputRef.current.dispatchEvent(new Event("input", { bubbles: true }));
            }
          }}
        />
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
        {autosave && <span className="self-center text-xs text-muted-foreground" aria-live="polite">{saveState}</span>}
      </div>
    </form>
  );
}
