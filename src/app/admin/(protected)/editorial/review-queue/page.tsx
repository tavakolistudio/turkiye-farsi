import type { Metadata } from "next";
import Link from "next/link";
import { getServiceContext } from "@/server/services/session-context";
import { editorialWorkflowService } from "@/server/services/editorial-workflow.service";
import { PERMISSIONS } from "@/server/rbac/permissions";
import { requirePermissionPage } from "@/server/auth/current-user";

export const metadata: Metadata = { title: "صف بررسی تحریریه", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ReviewQueuePage() {
  await requirePermissionPage(PERMISSIONS.ARTICLE_VIEW, "/admin/editorial/review-queue");
  const rows = await editorialWorkflowService.reviewQueue(await getServiceContext());
  return <div className="space-y-5"><h1 className="text-2xl font-bold">صف بررسی تحریریه</h1><div className="overflow-x-auto rounded-lg border"><table className="w-full text-sm"><thead className="bg-muted"><tr><th className="p-3 text-right">عنوان</th><th className="p-3 text-right">وضعیت</th><th className="p-3 text-right">نویسنده</th><th className="p-3 text-right">ویراستار</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-t"><td className="p-3"><Link className="font-medium text-primary" href={`/admin/articles/${row.id}/edit`}>{row.title}</Link></td><td className="p-3">{row.status}</td><td className="p-3">{row.author.name}</td><td className="p-3">{row.assignedEditor?.name ?? "—"}</td></tr>)}</tbody></table>{!rows.length && <p className="p-6 text-center text-muted-foreground">صف بررسی خالی است.</p>}</div></div>;
}
