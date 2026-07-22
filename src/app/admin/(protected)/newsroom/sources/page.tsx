import type { Metadata } from "next";
import Link from "next/link";
import { requirePermissionPage } from "@/server/auth/current-user";
import { getServiceContext } from "@/server/services/session-context";
import { newsroomService } from "@/server/newsroom/newsroom.service";
import { hasPermission } from "@/server/rbac/authz";
import { PERMISSIONS } from "@/server/rbac/permissions";
import { buttonVariants } from "@/components/ui/button";
import { SourceCollectionCard, type CollectionSource } from "./source-collection";

export const metadata: Metadata = { title: "منابع جمع‌آوری", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function NewsroomSourcesPage() {
  const actor = await requirePermissionPage(PERMISSIONS.NEWSROOM_VIEW, "/admin/newsroom/sources");
  const ctx = await getServiceContext();
  const sources = await newsroomService.listCollectionSources(ctx);
  const canManage = hasPermission(actor, PERMISSIONS.NEWSROOM_MANAGE_SOURCES);

  const mapped: CollectionSource[] = sources.map((s) => ({
    id: s.id, name: s.name, feedUrl: s.feedUrl, collectionMethod: s.collectionMethod,
    isEnabled: s.isEnabled, trustLevel: s.trustLevel, priority: s.priority,
    fetchIntervalMinutes: s.fetchIntervalMinutes, maxExcerptLength: s.maxExcerptLength,
    allowFullTextFetch: s.allowFullTextFetch,
    lastFetchedAt: s.lastFetchedAt?.toISOString() ?? null,
    lastSuccessfulFetchAt: s.lastSuccessfulFetchAt?.toISOString() ?? null,
    consecutiveFailures: s.consecutiveFailures, lastEtag: s.lastEtag, lastModifiedHeader: s.lastModifiedHeader,
    itemCount: s._count.ingestedItems,
  }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">منابع جمع‌آوری</h1>
          <p className="text-sm text-muted-foreground">
            فقط منابع دارای فید و «فعال» در جمع‌آوری خودکار بررسی می‌شوند. منبع جدید را از بخش «منابع» بسازید.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/sources/new" className={buttonVariants({ variant: "outline", size: "sm" })}>منبع جدید</Link>
          <Link href="/admin/newsroom" className={buttonVariants({ variant: "outline", size: "sm" })}>بازگشت</Link>
        </div>
      </div>

      {mapped.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
          هنوز منبعی ثبت نشده است.
        </div>
      ) : (
        <div className="space-y-3">
          {mapped.map((s) => (
            <SourceCollectionCard key={s.id} source={s} canManage={canManage} />
          ))}
        </div>
      )}
    </div>
  );
}
