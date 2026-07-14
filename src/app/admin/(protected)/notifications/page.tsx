import type { Metadata } from "next";
import { getServiceContext } from "@/server/services/session-context";
import { notificationService } from "@/server/services/notification.service";
import { NotificationList } from "@/components/admin/notification-list";

export const metadata: Metadata = { title: "اعلان‌های تحریریه", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const rows = await notificationService.listMine(await getServiceContext());
  return <div className="space-y-5"><h1 className="text-2xl font-bold">اعلان‌های تحریریه</h1><NotificationList initial={rows.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() }))} /></div>;
}
