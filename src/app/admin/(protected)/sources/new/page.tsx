import type { Metadata } from "next";
import { requirePermissionPage } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/server/rbac/permissions";
import { SourceForm } from "../source-form";
import { createSourceAction } from "../actions";

export const metadata: Metadata = { title: "منبع جدید", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function NewSourcePage() {
  await requirePermissionPage(PERMISSIONS.SOURCE_CREATE, "/admin/sources/new");
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">منبع جدید</h1>
      <SourceForm action={createSourceAction} />
    </div>
  );
}
