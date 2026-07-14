import Link from "next/link";
import { requireUser } from "@/server/auth/current-user";
import { logoutAction } from "@/server/auth/actions";
import { siteConfig } from "@/lib/site-config";
import { hasPermission } from "@/server/rbac/authz";
import { PERMISSIONS } from "@/server/rbac/permissions";
import { Button } from "@/components/ui/button";

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
    { href: "/admin/categories", label: "دسته‌بندی‌ها", show: hasPermission(user, PERMISSIONS.CATEGORY_VIEW) },
    { href: "/admin/tags", label: "برچسب‌ها", show: hasPermission(user, PERMISSIONS.TAG_VIEW) },
    { href: "/admin/sources", label: "منابع", show: hasPermission(user, PERMISSIONS.SOURCE_VIEW) },
    { href: "/admin/media", label: "کتابخانه رسانه", show: hasPermission(user, PERMISSIONS.MEDIA_VIEW) },
    { href: "/admin/users", label: "مدیریت کاربران", show: hasPermission(user, PERMISSIONS.USER_MANAGE) },
    { href: "/admin/change-password", label: "تغییر رمز عبور", show: true },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 border-l border-border bg-card p-4 md:block">
        <div className="mb-6">
          <p className="text-lg font-extrabold">{siteConfig.name}</p>
          <p className="text-xs text-muted-foreground">پنل مدیریت</p>
        </div>
        <nav className="space-y-1" aria-label="ناوبری اصلی پنل">
          {nav
            .filter((n) => n.show)
            .map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="block rounded-md px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
              >
                {n.label}
              </Link>
            ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-card px-6 py-3">
          <div className="text-sm">
            <span className="text-muted-foreground">خوش آمدید، </span>
            <span className="font-medium">{user.name}</span>
          </div>
          <form action={logoutAction}>
            <Button type="submit" variant="outline" size="sm">
              خروج
            </Button>
          </form>
        </header>

        <main id="main-content" className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
