import type { Metadata } from "next";
import Link from "next/link";
import { requirePermissionPage } from "@/server/auth/current-user";
import { getServiceContext } from "@/server/services/session-context";
import { newsroomService } from "@/server/newsroom/newsroom.service";
import { PERMISSIONS } from "@/server/rbac/permissions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "جزئیات اجرا", robots: { index: false } };
export const dynamic = "force-dynamic";

const JOB_TONE: Record<string, "green" | "red" | "yellow" | "muted"> = {
  SUCCESS: "green",
  FAILED: "red",
  SKIPPED: "yellow",
  STARTED: "muted",
};

const STAGE_LABEL: Record<string, string> = {
  FETCH: "واکشی", NORMALIZE: "نرمال‌سازی", DEDUPLICATE: "حذف تکراری", CLUSTER: "خوشه‌بندی",
  SCORE: "امتیازدهی", CLASSIFY: "دسته‌بندی", TRUST: "اعتبارسنجی", DRAFT: "پیش‌نویس", NOTIFY: "اطلاع‌رسانی",
};

export default async function NewsroomRunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermissionPage(PERMISSIONS.NEWSROOM_VIEW_LOGS, "/admin/newsroom/runs");
  const { id } = await params;
  const ctx = await getServiceContext();
  const { batch, logs } = await newsroomService.getRunLogs(ctx, id);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">جزئیات اجرا</h1>
          <p className="text-sm text-muted-foreground">
            {batch.status} · {new Date(batch.startedAt).toLocaleString("fa-IR")}
            {batch.completedAt && ` تا ${new Date(batch.completedAt).toLocaleString("fa-IR")}`}
          </p>
        </div>
        <Link href="/admin/newsroom/runs" className={buttonVariants({ variant: "outline", size: "sm" })}>
          بازگشت
        </Link>
      </div>

      {batch.errorSummary && (
        <Card className="border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{batch.errorSummary}</Card>
      )}

      {logs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
          برای این اجرا لاگ مرحله‌ای ثبت نشده است.
        </div>
      ) : (
        <div className="space-y-1.5">
          {logs.map((log) => (
            <Card key={log.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
              <div className="flex items-center gap-2">
                <Badge tone={JOB_TONE[log.status] ?? "muted"}>{log.status}</Badge>
                <span>{STAGE_LABEL[log.stage] ?? log.stage}</span>
                {log.attempt > 1 && <span className="text-xs text-muted-foreground">تلاش {log.attempt}</span>}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {log.errorCode && <span className="text-destructive">{log.errorCode}</span>}
                {log.errorMessageSafe && <span>{log.errorMessageSafe}</span>}
                <span>{new Date(log.startedAt).toLocaleTimeString("fa-IR")}</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
