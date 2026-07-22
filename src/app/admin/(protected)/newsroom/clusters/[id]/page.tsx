import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermissionPage } from "@/server/auth/current-user";
import { getServiceContext } from "@/server/services/session-context";
import { newsroomService } from "@/server/newsroom/newsroom.service";
import { hasPermission } from "@/server/rbac/authz";
import { PERMISSIONS } from "@/server/rbac/permissions";
import { buttonVariants } from "@/components/ui/button";
import { ClusterSplit, type ClusterItemRow } from "../clusters-ui";

export const metadata: Metadata = { title: "جزئیات خوشه", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ClusterDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePermissionPage(PERMISSIONS.NEWSROOM_VIEW, "/admin/newsroom/clusters");
  const { id } = await params;
  const ctx = await getServiceContext();
  const cluster = await newsroomService.getCluster(ctx, id).catch(() => null);
  if (!cluster) notFound();
  const canManage = hasPermission(actor, PERMISSIONS.NEWSROOM_MANAGE_CLUSTERS);

  const items: ClusterItemRow[] = cluster.items.map((ci) => ({
    id: ci.newsItem.id,
    title: ci.newsItem.title,
    sourceName: ci.newsItem.source.name,
  }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">جزئیات خوشه</h1>
          <p className="text-sm text-muted-foreground">{items.length} آیتم · {cluster.sourceCount} منبع</p>
        </div>
        <Link href="/admin/newsroom/clusters" className={buttonVariants({ variant: "outline", size: "sm" })}>بازگشت</Link>
      </div>
      <ClusterSplit clusterId={cluster.id} items={items} canManage={canManage} />
    </div>
  );
}
