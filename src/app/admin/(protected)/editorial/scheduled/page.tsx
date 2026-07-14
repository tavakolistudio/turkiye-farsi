import type { Metadata } from "next";
import Link from "next/link";
import { getServiceContext } from "@/server/services/session-context";
import { editorialWorkflowService } from "@/server/services/editorial-workflow.service";
import { PERMISSIONS } from "@/server/rbac/permissions";
import { requirePermissionPage } from "@/server/auth/current-user";

export const metadata: Metadata = { title: "مطالب زمان‌بندی‌شده", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ScheduledPage() {
  await requirePermissionPage(PERMISSIONS.ARTICLE_SCHEDULE, "/admin/editorial/scheduled");
  const rows = await editorialWorkflowService.scheduledArticles(await getServiceContext());
  const formatter = new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Istanbul" });
  return <div className="space-y-5"><h1 className="text-2xl font-bold">مطالب زمان‌بندی‌شده</h1><div className="space-y-2">{rows.map((row) => <div key={row.id} className="flex items-center justify-between rounded-lg border bg-card p-4"><Link className="font-medium text-primary" href={`/admin/articles/${row.id}/edit`}>{row.title}</Link><time>{row.scheduledAt ? formatter.format(row.scheduledAt) : "—"}</time></div>)}{!rows.length && <p className="rounded-lg border p-6 text-center text-muted-foreground">مطلب زمان‌بندی‌شده‌ای وجود ندارد.</p>}</div></div>;
}
