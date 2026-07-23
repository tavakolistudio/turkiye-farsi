"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { FormState } from "@/lib/forms";
import { COLLECTION_METHODS } from "@/lib/validations/newsroom";
import { saveSourceCollectionAction, toggleSourceAction, testFeedAction } from "../actions";

export interface CollectionSource {
  id: string;
  name: string;
  feedUrl: string | null;
  collectionMethod: string;
  isEnabled: boolean;
  trustLevel: number;
  priority: number;
  fetchIntervalMinutes: number;
  maxExcerptLength: number;
  allowFullTextFetch: boolean;
  lastFetchedAt: string | null;
  lastSuccessfulFetchAt: string | null;
  consecutiveFailures: number;
  lastEtag: string | null;
  lastModifiedHeader: string | null;
  itemCount: number;
}

export function SourceCollectionCard({ source, canManage }: { source: CollectionSource; canManage: boolean }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(saveSourceCollectionAction, {});
  const router = useRouter();
  const [feedUrl, setFeedUrl] = useState(source.feedUrl ?? "");
  const [testing, startTest] = useTransition();
  const [toggling, startToggle] = useTransition();
  const [test, setTest] = useState<(FormState & { result?: unknown }) | null>(null);

  return (
    <Card className="space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">{source.name}</h3>
          {source.isEnabled ? <Badge tone="green">فعال</Badge> : <Badge>غیرفعال</Badge>}
          {source.consecutiveFailures > 0 && <Badge tone="red">{source.consecutiveFailures} خطای متوالی</Badge>}
        </div>
        {canManage && (
          <Button
            size="sm"
            variant={source.isEnabled ? "outline" : "default"}
            disabled={toggling}
            onClick={() =>
              startToggle(async () => {
                await toggleSourceAction(source.id, !source.isEnabled);
                router.refresh();
              })
            }
          >
            {source.isEnabled ? "غیرفعال‌کردن" : "فعال‌کردن"}
          </Button>
        )}
      </div>

      <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-4">
        <span>آخرین دریافت: {fmt(source.lastFetchedAt)}</span>
        <span>آخرین موفق: {fmt(source.lastSuccessfulFetchAt)}</span>
        <span dir="ltr" className="truncate">ETag: {source.lastEtag ?? "—"}</span>
        <span dir="ltr" className="truncate">Last-Modified: {source.lastModifiedHeader ?? "—"}</span>
        <span>آیتم‌های جمع‌آوری‌شده: {source.itemCount}</span>
      </div>

      {state.error && <Alert variant="error">{state.error}</Alert>}
      {state.ok && state.message && <Alert variant="success">{state.message}</Alert>}
      {test && (test.ok ? <Alert variant="success">{test.message}</Alert> : test.message && <Alert variant="error">{test.message}</Alert>)}

      <form action={formAction} className="space-y-3">
        <input type="hidden" name="id" value={source.id} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor={`feed-${source.id}`}>نشانی فید</Label>
            <div className="flex gap-2">
              <Input id={`feed-${source.id}`} name="feedUrl" dir="ltr" value={feedUrl} onChange={(e) => setFeedUrl(e.target.value)} placeholder="https://…/rss" disabled={!canManage} />
              <Button
                type="button"
                variant="outline"
                disabled={!canManage || testing || !feedUrl}
                onClick={() => startTest(async () => setTest(await testFeedAction(feedUrl)))}
              >
                {testing ? "…" : "تست فید"}
              </Button>
            </div>
          </div>
          <Field label="روش جمع‌آوری">
            <Select name="collectionMethod" defaultValue={source.collectionMethod} disabled={!canManage}>
              {COLLECTION_METHODS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </Select>
          </Field>
          <Field label="اعتماد (۰-۱۰۰)"><Input name="trustLevel" type="number" dir="ltr" defaultValue={source.trustLevel} disabled={!canManage} /></Field>
          <Field label="اولویت"><Input name="priority" type="number" dir="ltr" defaultValue={source.priority} disabled={!canManage} /></Field>
          <Field label="بازه دریافت (دقیقه)"><Input name="fetchIntervalMinutes" type="number" dir="ltr" defaultValue={source.fetchIntervalMinutes} disabled={!canManage} /></Field>
          <Field label="حداکثر طول خلاصه"><Input name="maxExcerptLength" type="number" dir="ltr" defaultValue={source.maxExcerptLength} disabled={!canManage} /></Field>
          <label className="mt-6 flex items-center gap-2 text-sm">
            <input type="checkbox" name="isEnabled" defaultChecked={source.isEnabled} disabled={!canManage} /> فعال برای جمع‌آوری
          </label>
        </div>
        {canManage && (
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "در حال ذخیره…" : "ذخیره"}
          </Button>
        )}
      </form>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function fmt(v: string | null): string {
  if (!v) return "—";
  return new Date(v).toLocaleString("fa-IR");
}
