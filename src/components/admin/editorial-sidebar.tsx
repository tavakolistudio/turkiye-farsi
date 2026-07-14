"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import type { WorkflowAction } from "@/lib/editorial/workflow";

type Revision = { id: string; versionNumber: number; changeReason: string | null; createdAt: string; changedBy: { name: string } };
type Timeline = { id: string; fromStatus: string | null; toStatus: string; note: string | null; createdAt: string; actor: { name: string } };
type Correction = { id: string; title: string; description: string; correctionType: string; isPublished: boolean };
type Comment = { id: string; body: string; isResolved: boolean; author: { name: string }; replies: { id: string; body: string; author: { name: string } }[] };

const LABELS: Record<WorkflowAction, string> = {
  submit_review: "ارسال برای بررسی", request_correction: "درخواست اصلاح", approve: "تأیید",
  reject: "رد", schedule: "زمان‌بندی", cancel_schedule: "لغو زمان‌بندی", publish: "انتشار",
  unpublish: "لغو انتشار", archive: "بایگانی",
};

async function api(url: string, method: string, body?: unknown) {
  const response = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json() as { success: boolean; data?: unknown; error?: { message: string } };
  if (!response.ok || !result.success) throw new Error(result.error?.message || "عملیات ناموفق بود.");
  return result.data;
}

export function EditorialSidebar({ article, actions, editors, checklist, revisions, timeline, corrections, comments }: {
  article: { id: string; status: string; currentVersion: number; assignedEditorId: string | null };
  actions: WorkflowAction[];
  editors: { id: string; name: string }[];
  checklist: { valid: boolean; errors: string[]; warnings: string[] };
  revisions: Revision[];
  timeline: Timeline[];
  corrections: Correction[];
  comments: Comment[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [assignedEditorId, setAssignedEditorId] = useState(article.assignedEditorId ?? "");
  const [scheduledAt, setScheduledAt] = useState("");
  const [correctionTitle, setCorrectionTitle] = useState("");
  const [correctionBody, setCorrectionBody] = useState("");
  const [correctionType, setCorrectionType] = useState("MINOR");
  const [commentBody, setCommentBody] = useState("");
  const [compareFrom, setCompareFrom] = useState(revisions[1]?.id ?? "");
  const [compareTo, setCompareTo] = useState(revisions[0]?.id ?? "");
  const [comparison, setComparison] = useState<{ field: string; before: unknown; after: unknown }[]>([]);

  const run = async (work: () => Promise<unknown>) => {
    setBusy(true); setMessage("");
    try { await work(); setMessage("عملیات انجام شد."); router.refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "عملیات ناموفق بود."); }
    finally { setBusy(false); }
  };

  const workflow = (action: WorkflowAction) => run(async () => {
    let note: string | undefined;
    if (["request_correction", "reject", "unpublish"].includes(action)) {
      note = window.prompt("توضیح این تصمیم را وارد کنید:")?.trim();
      if (!note) throw new Error("ثبت توضیح الزامی است.");
    }
    const payload: Record<string, unknown> = { action, note };
    if (action === "submit_review") payload.assignedEditorId = assignedEditorId || null;
    if (action === "schedule") {
      if (!scheduledAt) throw new Error("زمان انتشار را وارد کنید.");
      payload.scheduledAt = `${scheduledAt}:00+03:00`;
    }
    await api(`/api/v1/admin/articles/${article.id}/workflow`, "POST", payload);
  });

  return (
    <aside className="space-y-4">
      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="font-bold">گردش کار</h2>
        <p className="mt-1 text-sm text-muted-foreground">وضعیت: {article.status}</p>
        <Select className="mt-3" value={assignedEditorId} onChange={(e) => setAssignedEditorId(e.target.value)} aria-label="ویراستار مسئول">
          <option value="">بدون ویراستار مسئول</option>
          {editors.map((editor) => <option key={editor.id} value={editor.id}>{editor.name}</option>)}
        </Select>
        {actions.includes("schedule") && <div className="mt-3"><label className="text-xs">زمان استانبول (UTC+3)</label><Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} /></div>}
        <div className="mt-3 flex flex-wrap gap-2">
          {actions.map((action) => <Button key={action} type="button" size="sm" variant={action === "publish" ? "default" : "outline"} disabled={busy} onClick={() => void workflow(action)}>{LABELS[action]}</Button>)}
        </div>
        <Button className="mt-3" type="button" size="sm" variant="outline" disabled={busy} onClick={() => void run(async () => {
          const data = await api(`/api/v1/admin/articles/${article.id}/preview-token`, "POST", { expiresInMinutes: 60 }) as { token: string };
          window.open(`/preview/${encodeURIComponent(data.token)}`, "_blank", "noopener,noreferrer");
        })}>پیش‌نمایش خصوصی</Button>
        {message && <p className="mt-2 text-xs" role="status">{message}</p>}
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="font-bold">چک‌لیست انتشار</h2>
        {checklist.valid && <p className="mt-2 text-sm text-emerald-600">موارد الزامی کامل است.</p>}
        {checklist.errors.map((item) => <p key={item} className="mt-1 text-sm text-destructive">• {item}</p>)}
        {checklist.warnings.map((item) => <p key={item} className="mt-1 text-sm text-amber-600">• {item}</p>)}
      </section>

      <details className="rounded-lg border border-border bg-card p-4" open>
        <summary className="cursor-pointer font-bold">نسخه‌ها ({revisions.length})</summary>
        {revisions.length >= 2 && <div className="mt-3 grid gap-2">
          <Select aria-label="نسخه مبدا مقایسه" value={compareFrom} onChange={(event) => setCompareFrom(event.target.value)}>{revisions.map((revision) => <option key={revision.id} value={revision.id}>نسخه {revision.versionNumber}</option>)}</Select>
          <Select aria-label="نسخه مقصد مقایسه" value={compareTo} onChange={(event) => setCompareTo(event.target.value)}>{revisions.map((revision) => <option key={revision.id} value={revision.id}>نسخه {revision.versionNumber}</option>)}</Select>
          <Button type="button" size="sm" variant="outline" disabled={busy || compareFrom === compareTo} onClick={() => void run(async () => {
            const result = await api(`/api/v1/admin/articles/${article.id}/revisions?from=${encodeURIComponent(compareFrom)}&to=${encodeURIComponent(compareTo)}`, "GET") as { changes: { field: string; before: unknown; after: unknown }[] };
            setComparison(result.changes);
          })}>مقایسهٔ دو نسخه</Button>
          {comparison.length > 0 && <div className="max-h-72 space-y-2 overflow-auto rounded border bg-muted/30 p-2 text-xs">{comparison.map((change, index) => <div key={`${change.field}-${index}`}><p className="font-bold">{change.field}</p><p className="text-red-700">قبل: {String(change.before ?? "—")}</p><p className="text-emerald-700">بعد: {String(change.after ?? "—")}</p></div>)}</div>}
          {comparison.length === 0 && <p className="text-xs text-muted-foreground">برای دیدن تفاوت‌ها دو نسخه را انتخاب کنید.</p>}
        </div>}
        <div className="mt-3 space-y-2">
          {revisions.map((revision) => <div key={revision.id} className="rounded border p-2 text-xs">
            <p>نسخه {revision.versionNumber} — {revision.changedBy.name}</p>
            <p className="text-muted-foreground">{revision.changeReason ?? "بدون توضیح"}</p>
            <Button className="mt-2" type="button" size="sm" variant="outline" disabled={busy} onClick={() => void run(() => api(`/api/v1/admin/articles/${article.id}/revisions/${revision.id}/restore`, "POST", { version: article.currentVersion }))}>بازیابی</Button>
          </div>)}
        </div>
      </details>

      <details className="rounded-lg border border-border bg-card p-4">
        <summary className="cursor-pointer font-bold">خط زمانی</summary>
        <div className="mt-3 space-y-2 text-xs">{timeline.map((event) => <div key={event.id} className="border-r-2 border-primary pr-2"><p>{event.fromStatus ?? "شروع"} ← {event.toStatus}</p><p className="text-muted-foreground">{event.actor.name} — {event.note ?? "بدون توضیح"}</p></div>)}</div>
      </details>

      <details className="rounded-lg border border-border bg-card p-4">
        <summary className="cursor-pointer font-bold">اصلاحیه‌ها ({corrections.length})</summary>
        <div className="mt-3 space-y-2">
          {corrections.map((correction) => <div key={correction.id} className="rounded border p-2 text-xs"><p className="font-bold">{correction.title}</p><p>{correction.description}</p>{!correction.isPublished && <Button className="mt-2" size="sm" type="button" disabled={busy} onClick={() => void run(() => api(`/api/v1/admin/articles/${article.id}/corrections/${correction.id}/publish`, "POST"))}>انتشار اصلاحیه</Button>}</div>)}
          <Input placeholder="عنوان اصلاحیه" value={correctionTitle} onChange={(e) => setCorrectionTitle(e.target.value)} />
          <Textarea placeholder="شرح اصلاحیه" value={correctionBody} onChange={(e) => setCorrectionBody(e.target.value)} />
          <Select aria-label="نوع اصلاحیه" value={correctionType} onChange={(event) => setCorrectionType(event.target.value)}><option value="MINOR">جزئی</option><option value="MAJOR">عمده</option><option value="FACTUAL">واقعی/اطلاعاتی</option><option value="LEGAL">حقوقی</option><option value="SOURCE_UPDATE">به‌روزرسانی منبع</option></Select>
          <Button type="button" size="sm" disabled={busy} onClick={() => void run(async () => { await api(`/api/v1/admin/articles/${article.id}/corrections`, "POST", { title: correctionTitle, description: correctionBody, correctionType, order: corrections.length }); setCorrectionTitle(""); setCorrectionBody(""); })}>ثبت اصلاحیه</Button>
        </div>
      </details>

      <details className="rounded-lg border border-border bg-card p-4">
        <summary className="cursor-pointer font-bold">نظرات تحریریه ({comments.length})</summary>
        <div className="mt-3 space-y-2 text-xs">{comments.map((comment) => <div key={comment.id} className="rounded border p-2"><p><strong>{comment.author.name}:</strong> {comment.body}</p>{comment.replies.map((reply) => <p key={reply.id} className="mr-3 text-muted-foreground">↳ {reply.author.name}: {reply.body}</p>)}<Button className="mt-2" type="button" size="sm" variant="outline" disabled={busy || comment.isResolved} onClick={() => void run(() => api(`/api/v1/admin/articles/${article.id}/comments/${comment.id}`, "PATCH", { isResolved: true }))}>{comment.isResolved ? "حل‌شده" : "حل کردن"}</Button></div>)}</div>
        <Textarea className="mt-3" placeholder="نظر داخلی تحریریه" value={commentBody} onChange={(e) => setCommentBody(e.target.value)} />
        <Button className="mt-2" type="button" size="sm" disabled={busy} onClick={() => void run(async () => { await api(`/api/v1/admin/articles/${article.id}/comments`, "POST", { body: commentBody }); setCommentBody(""); })}>ثبت نظر</Button>
      </details>
    </aside>
  );
}
