import { publicSiteService } from "@/server/services/public-site.service";
import { ArticleCard } from "@/components/public/article-card";
import { Breadcrumb, EmptyState, Pagination } from "@/components/public/ui";
import { routes } from "@/lib/public-links";
import { buildMetadata } from "@/lib/seo/metadata";
import { CONTENT_TYPES, CONTENT_TYPE_LABELS } from "@/lib/content-enums";

export const metadata = buildMetadata({
  title: "همه اخبار",
  description: "همه اخبار و مطالب ترکیه فارسی با امکان فیلتر بر اساس دسته‌بندی و نوع محتوا.",
  path: routes.news(),
});

type Props = {
  searchParams: Promise<{ page?: string; category?: string; type?: string; sort?: string }>;
};

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
    <div>
      <Breadcrumb items={[{ label: "همه اخبار" }]} />
      <h1 className="mb-6 text-2xl font-extrabold">همه اخبار</h1>

      <form method="get" className="mb-6 grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-4">
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
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((a) => <ArticleCard key={a.id} article={a} />)}
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
