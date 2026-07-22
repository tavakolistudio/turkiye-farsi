import type { Metadata } from "next";
import Link from "next/link";
import { requirePermissionPage } from "@/server/auth/current-user";
import { getServiceContext } from "@/server/services/session-context";
import { newsroomService } from "@/server/newsroom/newsroom.service";
import { hasPermission } from "@/server/rbac/authz";
import { PERMISSIONS } from "@/server/rbac/permissions";
import { buttonVariants } from "@/components/ui/button";
import { ClusterList, type ClusterRow } from "./clusters-ui";

export const metadata: Metadata = { title: "خوشه‌های خبری", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ClustersPage() {
  const actor = await requirePermissionPage(PERMISSIONS.NEWSROOM_VIEW, "/admin/newsroom/clusters");
  const ctx = await getServiceContext();
  const { rows } = await newsroomService.listClusters(ctx, { page: 1, pageSize: 50 });
  const canManage = hasPermission(actor, PERMISSIONS.NEWSROOM_MANAGE_CLUSTERS);

  const clusters: ClusterRow[] = rows.map((c) => ({
    id: c.id,
    representativeTitle: c.representativeItem?.title ?? null,
    sourceCount: c.sourceCount,
    itemCount: c._count.items,
    confidence: c.confidence,
    lastSeenAt: c.lastSeenAt.toISOString(),
  }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">خوشه‌های خبری</h1>
        <Link href="/admin/newsroom" className={buttonVariants({ variant: "outline", size: "sm" })}>بازگشت</Link>
      </div>
      <ClusterList clusters={clusters} canManage={canManage} />
    </div>
  );
}
