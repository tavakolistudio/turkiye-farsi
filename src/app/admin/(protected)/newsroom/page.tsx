import type { Metadata } from "next";
import Link from "next/link";
import { requirePermissionPage } from "@/server/auth/current-user";
import { getServiceContext } from "@/server/services/session-context";
import { newsroomService, type ItemListFilter } from "@/server/newsroom/newsroom.service";
import { newsroomSettingsService } from "@/server/newsroom/settings";
import { hasPermission } from "@/server/rbac/authz";
import { PERMISSIONS } from "@/server/rbac/permissions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { RunCollectionButton, ItemActions } from "./newsroom-actions";

export const metadata: Metadata = { title: "اتاق خبر هوشمند", robots: { index: false } };
export const dynamic = "force-dynamic";

const TABS: { key: string; label: string; bucket?: ItemListFilter["bucket"]; status?: string }[] = [
  { key: "urgent", label: "نیازمند بررسی فوری", bucket: "URGENT" },
  { key: "high", label: "اولویت بالا", bucket: "HIGH" },
  { key: "review", label: "بررسی عادی", bucket: "REVIEW" },
  { key: "low", label: "کم‌اهمیت", bucket: "LOW" },
  { key: "rejected", label: "ردشده", status: "REJECTED" },
  { key: "drafted", label: "پیش‌نویس‌شده", status: "DRAFTED" },
];

const VERIF_LABEL: Record<string, string> = {
  UNVERIFIED: "تأییدنشده",
  SINGLE_SOURCE: "تک‌منبع",
  MULTI_SOURCE: "چندمنبع",
  OFFICIAL_CONFIRMED: "تأیید رسمی",
  CONFLICTING: "متناقض",
  REJECTED: "ردشده",
};

export default async function NewsroomPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const actor = await requirePermissionPage(PERMISSIONS.NEWSROOM_VIEW, "/admin/newsroom");
  const sp = await searchParams;
  const activeKey = TABS.find((t) => t.key === sp.tab)?.key ?? "urgent";
  const tab = TABS.find((t) => t.key === activeKey)!;

  const ctx = await getServiceContext();
  const [{ rows, total }, stats, settings] = await Promise.all([
    newsroomService.listItems(ctx, { bucket: tab.bucket, status: tab.status, page: 1, pageSize: 30 }),
    newsroomService.stats(ctx),
    newsroomSettingsService.get(),
  ]);

  const canRun = hasPermission(actor, PERMISSIONS.NEWSROOM_RUN_COLLECTION);
  const canDraft = hasPermission(actor, PERMISSIONS.NEWSROOM_CREATE_DRAFT);
  const canReject = hasPermission(actor, PERMISSIONS.NEWSROOM_REJECT);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">اتاق خبر هوشمند</h1>
          <p className="text-sm text-muted-foreground">
            {settings.isEnabled && settings.collectionEnabled ? "جمع‌آوری فعال است" : "جمع‌آوری غیرفعال است"}
            {" · "}هوش مصنوعی: {settings.aiEnabled ? "فعال" : "غیرفعال"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/newsroom/settings" className={buttonVariants({ variant: "outline", size: "sm" })}>
            تنظیمات
          </Link>
          <Link href="/admin/newsroom/sources" className={buttonVariants({ variant: "outline", size: "sm" })}>
            منابع جمع‌آوری
          </Link>
          <Link href="/admin/newsroom/clusters" className={buttonVariants({ variant: "outline", size: "sm" })}>
            خوشه‌ها
          </Link>
          <RunCollectionButton canRun={canRun} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="کل آیتم‌ها" value={stats.items} />
        <Stat label="پیش‌نویس‌ها" value={stats.drafts} />
        <Stat
          label="آخرین اجرا"
          value={stats.lastBatch ? `${stats.lastBatch.newCount} تازه` : "—"}
        />
        <Stat label="وضعیت آخرین اجرا" value={stats.lastBatch?.status ?? "—"} />
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/newsroom?tab=${t.key}`}
            className={`rounded-md px-3 py-1.5 text-sm ${
              t.key === activeKey ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
          موردی در این دسته نیست.
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{total} مورد</p>
          {rows.map((item) => (
            <Card key={item.id} className="space-y-3 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <h2 className="font-semibold leading-6">{item.title}</h2>
                  {item.excerpt && <p className="line-clamp-2 text-sm text-muted-foreground">{item.excerpt}</p>}
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
                    <span>{item.source.name}</span>
                    {item.source.isOfficial && <Badge tone="green">رسمی</Badge>}
                    {item.publishedAt && <span>· {new Date(item.publishedAt).toLocaleDateString("fa-IR")}</span>}
                    <a href={item.sourceUrl} target="_blank" rel="noopener nofollow" className="underline">
                      منبع
                    </a>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
                  <ScoreBadge score={item.finalScore} />
                  <span className="text-muted-foreground">
                    اعتماد: {item.trustScore ?? "—"} · {VERIF_LABEL[item.verificationStatus ?? "UNVERIFIED"]}
                  </span>
                  {item.suggestedCategorySlug && (
                    <span className="text-muted-foreground">دسته: {item.suggestedCategorySlug}</span>
                  )}
                </div>
              </div>
              <Reasons reasons={item.scoreReasons} />
              {item.ingestionStatus !== "DRAFTED" && item.ingestionStatus !== "REJECTED" && (
                <ItemActions id={item.id} canDraft={canDraft} canReject={canReject} />
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </Card>
  );
}

function ScoreBadge({ score }: { score: number | null }) {
  const s = score ?? 0;
  const tone: "red" | "yellow" | "muted" = s >= 75 ? "red" : s >= 60 ? "yellow" : "muted";
  return <Badge tone={tone}>اهمیت: {score ?? "—"}</Badge>;
}

function Reasons({ reasons }: { reasons: unknown }) {
  const list = extractReasons(reasons);
  if (!list.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {list.slice(0, 6).map((r, i) => (
        <span key={i} className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {r}
        </span>
      ))}
    </div>
  );
}

function extractReasons(raw: unknown): string[] {
  if (!raw || typeof raw !== "object") return [];
  const o = raw as { importance?: unknown; trust?: unknown };
  const imp = Array.isArray(o.importance) ? (o.importance as string[]) : [];
  const tr = Array.isArray(o.trust) ? (o.trust as string[]) : [];
  return [...imp, ...tr].filter((x) => typeof x === "string");
}
