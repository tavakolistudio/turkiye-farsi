import type { Metadata } from "next";
import { publicSiteService } from "@/server/services/public-site.service";
import { ApiError } from "@/lib/api/errors";
import { ArticleCard } from "@/components/public/article-card";
import { Breadcrumb, EmptyState, Pagination } from "@/components/public/ui";
import { JsonLd } from "@/components/seo/json-ld";
import { routes } from "@/lib/public-links";
import { buildMetadata } from "@/lib/seo/metadata";
import { absoluteUrl } from "@/lib/seo/urls";
import { breadcrumbSchema, graph } from "@/lib/seo/jsonld";
import { redirectOrNotFound } from "@/server/seo/redirect-or-404";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
};

const PAGE_SIZE = 12;

function pageNum(v: string | undefined) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

async function load(slug: string, page: number) {
  try {
    return await publicSiteService.tagPage(decodeURIComponent(slug), (page - 1) * PAGE_SIZE, PAGE_SIZE);
  } catch (err) {
    if (err instanceof ApiError && err.code === "NOT_FOUND") return null;
    throw err;
  }
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = pageNum((await searchParams).page);
  const data = await load(slug, page);
  if (!data) return { title: "برچسب یافت نشد", robots: { index: false, follow: false } };
  return buildMetadata({
    title: `#${data.tag.name}${page > 1 ? ` — صفحه ${page}` : ""}`,
    description: `مطالب دارای برچسب «${data.tag.name}» در ترکیه فارسی.`,
    path: routes.tag(data.tag.slug),
    canonicalParams: { page },
    // Thin tag archives (no published articles) are kept out of the index.
    noindex: data.total === 0,
  });
}

export default async function TagPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const page = pageNum((await searchParams).page);
  const data = (await load(slug, page)) ?? (await redirectOrNotFound(`/tag/${decodeURIComponent(slug)}`));

  const { tag, rows, total } = data;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const crumbs = graph(
    breadcrumbSchema([
      { name: "خانه", url: absoluteUrl("/")! },
      { name: `برچسب: ${tag.name}`, url: absoluteUrl(routes.tag(tag.slug))! },
    ]),
  );

  return (
    <div>
      <JsonLd data={crumbs} />
      <Breadcrumb items={[{ label: `برچسب: ${tag.name}` }]} />
      <header className="mb-6 border-b border-border pb-4">
        <h1 className="text-2xl font-extrabold">#{tag.name}</h1>
        {tag.description && <p className="mt-2 text-muted-foreground">{tag.description}</p>}
      </header>

      {rows.length ? (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((a) => <ArticleCard key={a.id} article={a} />)}
          </div>
          <Pagination page={page} totalPages={totalPages} basePath={routes.tag(tag.slug)} />
        </>
      ) : (
        <EmptyState title="مطلبی با این برچسب یافت نشد" />
      )}
    </div>
  );
}
