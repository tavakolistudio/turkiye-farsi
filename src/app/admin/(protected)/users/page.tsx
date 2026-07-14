import type { Metadata } from "next";
import { requirePermissionPage } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/server/rbac/permissions";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { UserActions } from "./user-actions";

export const metadata: Metadata = { title: "مدیریت کاربران", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function UsersPage() {
  // Server-side authorization — not just a hidden nav link. Returns the actor.
  const me = await requirePermissionPage(PERMISSIONS.USER_MANAGE, "/admin/users");

  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" },
    include: {
      roles: { include: { role: { select: { name: true } } } },
      _count: { select: { sessions: { where: { revokedAt: null } } } },
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">مدیریت کاربران</h1>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-right text-muted-foreground">
            <tr>
              <th className="p-3 font-medium">نام</th>
              <th className="p-3 font-medium">ایمیل</th>
              <th className="p-3 font-medium">نقش‌ها</th>
              <th className="p-3 font-medium">وضعیت</th>
              <th className="p-3 font-medium">نشست فعال</th>
              <th className="p-3 font-medium">عملیات</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-border last:border-0">
                <td className="p-3 font-medium">{u.name}</td>
                <td className="p-3" dir="ltr">
                  {u.email}
                </td>
                <td className="p-3">
                  {u.roles.map((r) => r.role.name).join("، ") || "—"}
                </td>
                <td className="p-3">
                  {u.isActive ? (
                    <span className="text-green-700 dark:text-green-400">فعال</span>
                  ) : (
                    <span className="text-destructive">غیرفعال</span>
                  )}
                </td>
                <td className="p-3">{u._count.sessions}</td>
                <td className="p-3">
                  <UserActions userId={u.id} isActive={u.isActive} isSelf={u.id === me.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
