import Link from "next/link";
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
    return await publicSiteService.categoryPage(decodeURIComponent(slug), (page - 1) * PAGE_SIZE, PAGE_SIZE);
  } catch (err) {
    if (err instanceof ApiError && err.code === "NOT_FOUND") return null;
    throw err;
  }
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = pageNum((await searchParams).page);
  const data = await load(slug, page);
  if (!data) return { title: "دسته‌بندی یافت نشد", robots: { index: false, follow: false } };
  const titleSuffix = page > 1 ? ` — صفحه ${page}` : "";
  return buildMetadata({
    title: `${data.category.name}${titleSuffix}`,
    description: data.category.description ?? `آخرین اخبار و مطالب دسته «${data.category.name}» در ترکیه فارسی.`,
    // Paginated pages canonicalise to themselves (page kept in the canonical).
    path: routes.category(data.category.slug),
    canonicalParams: { page },
  });
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const page = pageNum((await searchParams).page);
  const data = (await load(slug, page)) ?? (await redirectOrNotFound(`/category/${decodeURIComponent(slug)}`));

  const { category, rows, total } = data;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const crumbs = graph(
    breadcrumbSchema([
      { name: "خانه", url: absoluteUrl("/")! },
      ...(category.parent ? [{ name: category.parent.name, url: absoluteUrl(routes.category(category.parent.slug))! }] : []),
      { name: category.name, url: absoluteUrl(routes.category(category.slug))! },
    ]),
  );

  return (
    <div>
      <JsonLd data={crumbs} />
      <Breadcrumb
        items={[
          ...(category.parent ? [{ label: category.parent.name, href: routes.category(category.parent.slug) }] : []),
          { label: category.name },
        ]}
      />

      <header className="mb-6 border-b border-border pb-4">
        <h1 className="text-2xl font-extrabold">{category.name}</h1>
        {category.description && <p className="mt-2 text-muted-foreground">{category.description}</p>}
        {category.children.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2">
            {category.children.map((c) => (
              <li key={c.slug}>
                <Link href={routes.category(c.slug)} className="rounded-full border border-border px-3 py-1 text-sm hover:bg-accent">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </header>

      {rows.length ? (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((a) => <ArticleCard key={a.id} article={a} />)}
          </div>
          <Pagination page={page} totalPages={totalPages} basePath={routes.category(category.slug)} />
        </>
      ) : (
        <EmptyState
          title="هنوز مطلبی در این دسته منتشر نشده است"
          description="به‌زودی مطالب این بخش در دسترس قرار می‌گیرد."
        />
      )}
    </div>
  );
}
