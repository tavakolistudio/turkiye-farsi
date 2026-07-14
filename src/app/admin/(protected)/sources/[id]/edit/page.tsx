import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermissionPage } from "@/server/auth/current-user";
import { getServiceContext } from "@/server/services/session-context";
import { sourceService } from "@/server/services/source.service";
import { PERMISSIONS } from "@/server/rbac/permissions";
import { SourceForm } from "../../source-form";
import { updateSourceAction } from "../../actions";

export const metadata: Metadata = { title: "ویرایش منبع", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function EditSourcePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermissionPage(PERMISSIONS.SOURCE_UPDATE, "/admin/sources");
  const { id } = await params;
  const s = await sourceService.getById(await getServiceContext(), id).catch(() => null);
  if (!s) notFound();

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">ویرایش منبع</h1>
      <SourceForm
        action={updateSourceAction}
        initial={{
          id: s.id,
          name: s.name,
          slug: s.slug,
          websiteUrl: s.websiteUrl,
          country: s.country,
          language: s.language,
          sourceType: s.sourceType,
          credibilityLevel: s.credibilityLevel,
          isOfficial: s.isOfficial,
          isActive: s.isActive,
          description: s.description,
        }}
      />
    </div>
  );
}
