import type { Metadata } from "next";
import { requireUser } from "@/server/auth/current-user";
import { hasPermission } from "@/server/rbac/authz";
import { PERMISSIONS } from "@/server/rbac/permissions";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "داشبورد", robots: { index: false } };

export default async function DashboardPage() {
  // Re-assert auth here too (defence in depth); redirects if the session became
  // invalid between the layout render and this page render.
  const user = await requireUser("/admin");

  const canViewAnalytics = hasPermission(user, PERMISSIONS.ANALYTICS_VIEW);
  const stats = canViewAnalytics
    ? {
        articles: await prisma.article.count({ where: { deletedAt: null } }),
        published: await prisma.article.count({ where: { status: "PUBLISHED", deletedAt: null } }),
        users: await prisma.user.count({ where: { deletedAt: null } }),
        subscribers: await prisma.newsletterSubscriber.count(),
      }
    : null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">داشبورد</h1>

      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="کل مطالب" value={stats.articles} />
          <Stat label="منتشرشده" value={stats.published} />
          <Stat label="کاربران" value={stats.users} />
          <Stat label="اعضای خبرنامه" value={stats.subscribers} />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>حساب شما</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            <span className="text-muted-foreground">نام: </span>
            {user.name}
          </p>
          <p dir="ltr" className="text-right">
            <span className="text-muted-foreground">ایمیل: </span>
            {user.email}
          </p>
          <div>
            <span className="text-muted-foreground">نقش‌ها: </span>
            {user.roleKeys.length ? user.roleKeys.join("، ") : "—"}
          </div>
          <div>
            <span className="text-muted-foreground">تعداد مجوزهای مؤثر: </span>
            {user.permissions.size}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>مجوزهای شما</CardTitle>
        </CardHeader>
        <CardContent>
          {user.permissions.size === 0 ? (
            <p className="text-sm text-muted-foreground">هیچ مجوزی اختصاص داده نشده است.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {[...user.permissions].sort().map((p) => (
                <li
                  key={p}
                  className="rounded-md border border-border bg-muted px-2 py-1 font-mono text-xs"
                  dir="ltr"
                >
                  {p}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold">{value.toLocaleString("fa-IR")}</p>
      </CardContent>
    </Card>
  );
}
