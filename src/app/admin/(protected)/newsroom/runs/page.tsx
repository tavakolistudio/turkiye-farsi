import type { Metadata } from "next";
import Link from "next/link";
import { requirePermissionPage } from "@/server/auth/current-user";
import { getServiceContext } from "@/server/services/session-context";
import { newsroomService } from "@/server/newsroom/newsroom.service";
import { PERMISSIONS } from "@/server/rbac/permissions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "اجراهای اتاق خبر", robots: { index: false } };
export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, "green" | "red" | "yellow" | "muted"> = {
  COMPLETED: "green",
  FAILED: "red",
  PARTIAL: "yellow",
  RUNNING: "muted",
};

export default async function NewsroomRunsPage() {
  await requirePermissionPage(PERMISSIONS.NEWSROOM_VIEW_LOGS, "/admin/newsroom/runs");
  const ctx = await getServiceContext();
  const { rows } = await newsroomService.listRuns(ctx, { page: 1, pageSize: 30 });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">اجراهای اتاق خبر</h1>
          <p className="text-sm text-muted-foreground">تاریخچه اجراهای جمع‌آوری و گزارش مرحله‌به‌مرحله هر اجرا.</p>
        </div>
        <Link href="/admin/newsroom" className={buttonVariants({ variant: "outline", size: "sm" })}>
          بازگشت
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
          هنوز هیچ اجرایی ثبت نشده است.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((run) => (
            <Link key={run.id} href={`/admin/newsroom/runs/${run.id}`}>
              <Card className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-muted/50">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm">
                    <Badge tone={STATUS_TONE[run.status] ?? "muted"}>{run.status}</Badge>
                    <span className="text-muted-foreground">{run.trigger === "manual" ? "دستی" : "زمان‌بندی‌شده"}</span>
                    <span className="text-muted-foreground">· {new Date(run.startedAt).toLocaleString("fa-IR")}</span>
                  </div>
                  {run.errorSummary && <p className="text-xs text-destructive">{run.errorSummary}</p>}
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>منابع: {run.sourceCount}</span>
                  <span>واکشی: {run.fetchedCount}</span>
                  <span>تازه: {run.newCount}</span>
                  <span>تکراری: {run.duplicateCount}</span>
                  <span>ردشده: {run.rejectedCount}</span>
                  <span>خطا: {run.failedCount}</span>
                  <span>پیش‌نویس: {run.draftedCount}</span>
                  {run.aiCallCount > 0 && <span>تماس‌های AI: {run.aiCallCount}</span>}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
