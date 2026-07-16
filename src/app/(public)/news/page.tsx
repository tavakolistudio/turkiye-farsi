import { publicSiteService } from "@/server/services/public-site.service";
import { ArticleCard } from "@/components/public/article-card";
import { Breadcrumb, EmptyState, Pagination } from "@/components/public/ui";
import { routes } from "@/lib/public-links";
import { buildMetadata } from "@/lib/seo/metadata";
import { CONTENT_TYPES, CONTENT_TYPE_LABELS } from "@/lib/content-enums";
import { siteSettingsService } from "@/server/services/site-settings.service";

type Props = {
  searchParams: Promise<{ page?: string; category?: string; type?: string; sort?: string }>;
};

export async function generateMetadata({ searchParams }: Props) {
  const [sp, publisher] = await Promise.all([searchParams, siteSettingsService.publisher()]);
  const page = Number(sp.page);
  return buildMetadata({
    title: "همه اخبار",
    description: "همه اخبار و مطالب ترکیه فارسی با امکان فیلتر بر اساس دسته‌بندی و نوع محتوا.",
    path: routes.news(),
    canonicalParams: { page: Number.isInteger(page) && page > 1 ? page : undefined },
    fallbackImage: publisher.logo,
  });
}

const PAGE_SIZE = 12;
const SORTS = [
  { key: "newest", label: "جدیدترین" },
  { key: "oldest", label: "قدیمی‌ترین" },
  { key: "most-viewed", label: "پربازدیدترین" },
] as const;

export default async function NewsIndexPage({ searchParams }: Props) {
  const sp = await searchParams;
  const n = Number(sp.page);
  const page = Number.isInteger(n) && n > 0 ? n : 1;
  const sort = (SORTS.find((s) => s.key === sp.sort)?.key ?? "newest") as "newest" | "oldest" | "most-viewed";
  const contentType = CONTENT_TYPES.includes(sp.type as never) ? sp.type : undefined;
  const categorySlug = sp.category?.trim() || undefined;

  const [{ rows, total }, categories] = await Promise.all([
    publicSiteService.newsIndex({
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      categorySlug,
      contentType,
      sort,
    }),
    publicSiteService.navCategories(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="editorial-listing-page">
      <Breadcrumb items={[{ label: "همه اخبار" }]} />
      <header className="editorial-listing-header"><p>آرشیو</p><h1>همه اخبار</h1></header>

      <form method="get" className="editorial-filter-form">
        <div>
          <label htmlFor="f-category" className="mb-1 block text-xs font-medium">دسته‌بندی</label>
          <select id="f-category" name="category" defaultValue={categorySlug ?? ""} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
            <option value="">همه دسته‌ها</option>
            {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="f-type" className="mb-1 block text-xs font-medium">نوع محتوا</label>
          <select id="f-type" name="type" defaultValue={contentType ?? ""} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
            <option value="">همه انواع</option>
            {CONTENT_TYPES.map((t) => <option key={t} value={t}>{CONTENT_TYPE_LABELS[t]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="f-sort" className="mb-1 block text-xs font-medium">مرتب‌سازی</label>
          <select id="f-sort" name="sort" defaultValue={sort} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
            {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
        <div className="flex items-end">
          <button type="submit" className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
            اعمال فیلتر
          </button>
        </div>
      </form>

      {rows.length ? (
        <>
          <div className="editorial-list-grid">
            {rows.map((a) => <ArticleCard key={a.id} article={a} variant="horizontal" />)}
          </div>
          <Pagination
            page={page}
            totalPages={totalPages}
            basePath={routes.news()}
            params={{ category: categorySlug, type: contentType, sort }}
          />
        </>
      ) : (
        <EmptyState title="مطلبی با این فیلترها یافت نشد" description="فیلترها را تغییر دهید یا همه اخبار را ببینید." />
      )}
    </div>
  );
}
