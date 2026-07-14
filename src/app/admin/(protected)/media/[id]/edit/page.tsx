import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermissionPage } from "@/server/auth/current-user";
import { getServiceContext } from "@/server/services/session-context";
import { mediaService } from "@/server/services/media.service";
import { PERMISSIONS } from "@/server/rbac/permissions";
import { MediaMetaForm } from "./meta-form";

export const metadata: Metadata = { title: "ویرایش رسانه", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function EditMediaPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermissionPage(PERMISSIONS.MEDIA_UPDATE, "/admin/media");
  const { id } = await params;
  const media = await mediaService.getById(await getServiceContext(), id).catch(() => null);
  if (!media) notFound();

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">ویرایش رسانه</h1>
      <p className="text-sm text-muted-foreground" dir="ltr">{media.originalFilename}</p>
      <MediaMetaForm initial={{ id: media.id, alt: media.alt, caption: media.caption, credit: media.credit }} />
    </div>
  );
}
