import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { publicSiteService } from "@/server/services/public-site.service";
import { ArticleBody } from "@/components/content/article-body";
import { Breadcrumb } from "@/components/public/ui";
import { formatJalali, toIso } from "@/lib/dates";
import { routes } from "@/lib/public-links";

/** Shared metadata builder for the institutional static pages. */
export async function staticPageMetadata(slug: string): Promise<Metadata> {
  const page = await publicSiteService.getStaticPage(slug);
  if (!page) return { title: "صفحه یافت نشد" };
  return {
    title: page.metaTitle ?? page.title,
    description: page.metaDescription ?? undefined,
    alternates: { canonical: routes.page(slug) },
  };
}

/** Renders a DB-backed static page, or 404 when it is missing/unpublished. */
export async function StaticPageView({ slug }: { slug: string }) {
  const page = await publicSiteService.getStaticPage(slug);
  if (!page) notFound();

  const updated = page.updatedAt ? new Date(page.updatedAt) : null;

  return (
    <article className="mx-auto max-w-3xl">
      <Breadcrumb items={[{ label: page.title }]} />
      <h1 className="text-3xl font-extrabold">{page.title}</h1>
      {updated && (
        <p className="mt-2 text-sm text-muted-foreground">
          آخرین به‌روزرسانی: <time dateTime={toIso(updated)}>{formatJalali(updated)}</time>
        </p>
      )}
      <div className="mt-6">
        <ArticleBody value={page.bodyJson} />
      </div>
    </article>
  );
}
