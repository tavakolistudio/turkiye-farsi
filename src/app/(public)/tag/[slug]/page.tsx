import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { publicSiteService } from "@/server/services/public-site.service";
import { ApiError } from "@/lib/api/errors";
import { ArticleCard } from "@/components/public/article-card";
import { Breadcrumb, EmptyState, Pagination } from "@/components/public/ui";
import { routes } from "@/lib/public-links";

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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug, 1);
  if (!data) return { title: "برچسب یافت نشد" };
  return {
    title: `#${data.tag.name}`,
    description: `مطالب دارای برچسب «${data.tag.name}» در ترکیه فارسی.`,
    alternates: { canonical: routes.tag(data.tag.slug) },
  };
}

export default async function TagPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const page = pageNum((await searchParams).page);
  const data = await load(slug, page);
  if (!data) notFound();

  const { tag, rows, total } = data;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
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
