import Link from "next/link";
import { requireUser } from "@/server/auth/current-user";
import { logoutAction } from "@/server/auth/actions";
import { siteConfig } from "@/lib/site-config";
import { hasPermission } from "@/server/rbac/authz";
import { PERMISSIONS } from "@/server/rbac/permissions";
import { Button } from "@/components/ui/button";
import { AdminNav } from "@/components/admin/admin-nav";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side authentication gate for the whole protected admin area.
  const user = await requireUser("/admin");

  // Nav items are filtered by permission — but this is convenience only;
  // each destination re-checks authorization on the server.
  const nav: { href: string; label: string; show: boolean }[] = [
    { href: "/admin", label: "داشبورد", show: true },
    { href: "/admin/articles", label: "مطالب", show: hasPermission(user, PERMISSIONS.ARTICLE_VIEW) },
    { href: "/admin/editorial/review-queue", label: "صف بررسی", show: hasPermission(user, PERMISSIONS.ARTICLE_VIEW) },
    { href: "/admin/editorial/scheduled", label: "زمان‌بندی‌شده", show: hasPermission(user, PERMISSIONS.ARTICLE_SCHEDULE) },
    { href: "/admin/newsroom", label: "اتاق خبر هوشمند", show: hasPermission(user, PERMISSIONS.NEWSROOM_VIEW) },
    { href: "/admin/notifications", label: "اعلان‌ها", show: hasPermission(user, PERMISSIONS.ARTICLE_VIEW) },
    { href: "/admin/categories", label: "دسته‌بندی‌ها", show: hasPermission(user, PERMISSIONS.CATEGORY_VIEW) },
    { href: "/admin/tags", label: "برچسب‌ها", show: hasPermission(user, PERMISSIONS.TAG_VIEW) },
    { href: "/admin/sources", label: "منابع", show: hasPermission(user, PERMISSIONS.SOURCE_VIEW) },
    { href: "/admin/media", label: "کتابخانه رسانه", show: hasPermission(user, PERMISSIONS.MEDIA_VIEW) },
    { href: "/admin/users", label: "مدیریت کاربران", show: hasPermission(user, PERMISSIONS.USER_MANAGE) },
    { href: "/admin/change-password", label: "تغییر رمز عبور", show: true },
  ];

  return (
    <div className="admin-shell">
      <div className="admin-layout">
        <aside className="admin-sidebar">
          <div>
            <p className="admin-brand-name">{siteConfig.name}</p>
            <p className="admin-brand-sub">پنل مدیریت</p>
          </div>
          <AdminNav items={nav.filter((n) => n.show).map(({ href, label }) => ({ href, label }))} />
        </aside>

        <div className="admin-main-col">
          <header className="admin-topbar">
            <div className="admin-topbar-inner">
              <div>
                <span className="text-muted-foreground">خوش آمدید، </span>
                <span className="font-medium">{user.name}</span>
              </div>
              <div className="admin-topbar-actions">
                <Link href="/">مشاهده سایت</Link>
                <form action={logoutAction}>
                  <Button type="submit" variant="outline" size="sm">
                    خروج
                  </Button>
                </form>
              </div>
            </div>
          </header>

          <main id="main-content" className="admin-main">
            <div className="admin-container">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
