import type { Metadata } from "next";
import Link from "next/link";
import { requirePermissionPage } from "@/server/auth/current-user";
import { getServiceContext } from "@/server/services/session-context";
import { newsroomService } from "@/server/newsroom/newsroom.service";
import { hasAnyPermission } from "@/server/rbac/authz";
import { PERMISSIONS } from "@/server/rbac/permissions";
import { buttonVariants } from "@/components/ui/button";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "تنظیمات اتاق خبر", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function NewsroomSettingsPage() {
  const actor = await requirePermissionPage(PERMISSIONS.NEWSROOM_VIEW, "/admin/newsroom/settings");
  const ctx = await getServiceContext();
  const settings = await newsroomService.getSettings(ctx);
  const canEdit = hasAnyPermission(actor, [PERMISSIONS.NEWSROOM_MANAGE_SCORING, PERMISSIONS.SETTINGS_MANAGE]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">تنظیمات اتاق خبر</h1>
        <Link href="/admin/newsroom" className={buttonVariants({ variant: "outline", size: "sm" })}>
          بازگشت به صف
        </Link>
      </div>
      <SettingsForm initial={settings} canEdit={canEdit} />
    </div>
  );
}
