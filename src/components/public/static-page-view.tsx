import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { publicSiteService } from "@/server/services/public-site.service";
import { ArticleBody } from "@/components/content/article-body";
import { Breadcrumb } from "@/components/public/ui";
import { JsonLd } from "@/components/seo/json-ld";
import { bodyJsonText } from "@/lib/editorial/content";
import { formatJalali, toIso } from "@/lib/dates";
import { routes } from "@/lib/public-links";
import { buildMetadata } from "@/lib/seo/metadata";
import { absoluteUrl } from "@/lib/seo/urls";
import { breadcrumbSchema, graph } from "@/lib/seo/jsonld";

/** Shared metadata builder for the institutional static pages. */
export async function staticPageMetadata(slug: string): Promise<Metadata> {
  const page = await publicSiteService.getStaticPage(slug);
  if (!page) return { title: "صفحه یافت نشد", robots: { index: false, follow: false } };
  const empty = bodyJsonText(page.bodyJson).trim().length < 20;
  return buildMetadata({
    title: page.metaTitle ?? page.title,
    description: page.metaDescription ?? undefined,
    path: routes.page(slug),
    // Empty/stub pages must not be indexed.
    noindex: empty,
  });
}

/** Renders a DB-backed static page, or 404 when it is missing/unpublished. */
export async function StaticPageView({ slug }: { slug: string }) {
  const page = await publicSiteService.getStaticPage(slug);
  if (!page) notFound();

  const updated = page.updatedAt ? new Date(page.updatedAt) : null;
  const crumbs = graph(
    breadcrumbSchema([
      { name: "خانه", url: absoluteUrl("/")! },
      { name: page.title, url: absoluteUrl(routes.page(slug))! },
    ]),
  );

  return (
    <article className="mx-auto max-w-3xl">
      <JsonLd data={crumbs} />
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
