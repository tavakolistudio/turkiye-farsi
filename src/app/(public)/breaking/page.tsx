import { publicSiteService } from "@/server/services/public-site.service";
import { ArticleCard } from "@/components/public/article-card";
import { Breadcrumb, EmptyState, Pagination } from "@/components/public/ui";
import { routes } from "@/lib/public-links";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "اخبار فوری",
  description: "مهم‌ترین و فوری‌ترین اخبار ترکیه فارسی.",
  path: routes.breaking(),
});

type Props = { searchParams: Promise<{ page?: string }> };
const PAGE_SIZE = 12;

export default async function BreakingPage({ searchParams }: Props) {
  const n = Number((await searchParams).page);
  const page = Number.isInteger(n) && n > 0 ? n : 1;
  const { rows, total } = await publicSiteService.breaking((page - 1) * PAGE_SIZE, PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <Breadcrumb items={[{ label: "اخبار فوری" }]} />
      <h1 className="mb-6 flex items-center gap-2 text-2xl font-extrabold">
        <span className="inline-block h-6 w-1.5 rounded bg-breaking" aria-hidden="true" />
        اخبار فوری
      </h1>

      {rows.length ? (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((a) => <ArticleCard key={a.id} article={a} />)}
          </div>
          <Pagination page={page} totalPages={totalPages} basePath={routes.breaking()} />
        </>
      ) : (
        <EmptyState
          title="در حال حاضر خبر فوری‌ای وجود ندارد"
          description="هر زمان خبر فوری منتشر شود، در این صفحه نمایش داده می‌شود."
        />
      )}
    </div>
  );
}
