import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermissionPage } from "@/server/auth/current-user";
import { getServiceContext } from "@/server/services/session-context";
import { tagService } from "@/server/services/tag.service";
import { PERMISSIONS } from "@/server/rbac/permissions";
import { TagForm } from "../../tag-form";
import { updateTagAction } from "../../actions";

export const metadata: Metadata = { title: "ویرایش برچسب", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function EditTagPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermissionPage(PERMISSIONS.TAG_UPDATE, "/admin/tags");
  const { id } = await params;
  const tag = await tagService.getById(await getServiceContext(), id).catch(() => null);
  if (!tag) notFound();

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">ویرایش برچسب</h1>
      <TagForm
        action={updateTagAction}
        initial={{ id: tag.id, name: tag.name, slug: tag.slug, description: tag.description }}
      />
    </div>
  );
}
