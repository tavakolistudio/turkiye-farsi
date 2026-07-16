import { publicSiteService } from "@/server/services/public-site.service";
import { ArticleCard } from "@/components/public/article-card";
import { Breadcrumb, EmptyState, Pagination } from "@/components/public/ui";
import { routes } from "@/lib/public-links";
import { buildMetadata } from "@/lib/seo/metadata";
import { siteSettingsService } from "@/server/services/site-settings.service";

type Props = { searchParams: Promise<{ page?: string }> };
const PAGE_SIZE = 12;

export async function generateMetadata({ searchParams }: Props) {
  const [sp, publisher] = await Promise.all([searchParams, siteSettingsService.publisher()]);
  const page = Number(sp.page);
  return buildMetadata({
    title: "اخبار فوری",
    description: "مهم‌ترین و فوری‌ترین اخبار ترکیه فارسی.",
    path: routes.breaking(),
    canonicalParams: { page: Number.isInteger(page) && page > 1 ? page : undefined },
    fallbackImage: publisher.logo,
  });
}

export default async function BreakingPage({ searchParams }: Props) {
  const n = Number((await searchParams).page);
  const page = Number.isInteger(n) && n > 0 ? n : 1;
  const { rows, total } = await publicSiteService.breaking((page - 1) * PAGE_SIZE, PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="editorial-listing-page">
      <Breadcrumb items={[{ label: "اخبار فوری" }]} />
      <h1 className="editorial-standalone-title editorial-standalone-title-breaking">
        <span className="inline-block h-6 w-1.5 rounded bg-breaking" aria-hidden="true" />
        اخبار فوری
      </h1>

      {rows.length ? (
        <>
          <div className="editorial-three-grid">
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
