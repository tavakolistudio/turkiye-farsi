import type { Metadata } from "next";
import { requirePermissionPage } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/server/rbac/permissions";
import { TagForm } from "../tag-form";
import { createTagAction } from "../actions";

export const metadata: Metadata = { title: "برچسب جدید", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function NewTagPage() {
  await requirePermissionPage(PERMISSIONS.TAG_CREATE, "/admin/tags/new");
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">برچسب جدید</h1>
      <TagForm action={createTagAction} />
    </div>
  );
}
