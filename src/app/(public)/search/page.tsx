import { headers } from "next/headers";
import { publicSiteService } from "@/server/services/public-site.service";
import { searchService, searchQuerySchema } from "@/server/services/search.service";
import { rateLimit } from "@/server/api/rate-limit";
import { Breadcrumb, EmptyState } from "@/components/public/ui";
import { routes } from "@/lib/public-links";
import { toPersianDigits } from "@/lib/dates";
import { buildMetadata } from "@/lib/seo/metadata";
import { SearchResults } from "@/components/public/search-results";

// Search result pages are intentionally kept out of the index.
export const metadata = buildMetadata({
  title: "جستجو",
  description: "جستجو در اخبار و مطالب ترکیه فارسی.",
  path: routes.search(),
  noindex: true,
});

type Props = {
  searchParams: Promise<{
    q?: string;
    page?: string;
    sort?: string;
    category?: string;
    author?: string;
    from?: string;
    to?: string;
  }>;
};

export default async function SearchPage({ searchParams }: Props) {
  const sp = await searchParams;
  const rawQuery = (sp.q ?? "").trim();
  const [categories, authors] = await Promise.all([
    publicSiteService.navCategories(),
    publicSiteService.searchAuthors(),
  ]);

  // Validate the incoming query; invalid/short queries just show a prompt.
  const parsed = searchQuerySchema.safeParse({
    q: rawQuery,
    page: sp.page,
    sort: sp.sort,
    category: sp.category,
    author: sp.author,
    from: sp.from,
    to: sp.to,
  });

  let body: React.ReactNode;

  if (!rawQuery) {
    body = <EmptyState title="عبارتی برای جستجو وارد کنید" description="عنوان، متن خبر، دسته‌بندی، برچسب یا نام نویسنده را جستجو کنید." />;
  } else if (!parsed.success) {
    body = <EmptyState title="عبارت جستجو معتبر نیست" description="عبارت جستجو باید حداقل ۲ نویسه باشد." />;
  } else {
    // Basic per-IP rate limiting for search.
    const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const { ok } = rateLimit(`search:${ip}`, 30, 60_000);
    if (!ok) {
      body = <EmptyState title="تعداد جستجوها زیاد است" description="کمی صبر کنید و دوباره تلاش کنید." />;
    } else {
      const result = await searchService.search(parsed.data);
      if (result.rows.length) {
        body = (
          <>
            <p className="mb-4 text-sm text-muted-foreground">
              {toPersianDigits(result.total)} نتیجه برای «{rawQuery}»
            </p>
            <SearchResults
              key={`${rawQuery}:${parsed.data.sort}:${parsed.data.category ?? ""}:${parsed.data.author ?? ""}:${parsed.data.from ?? ""}:${parsed.data.to ?? ""}`}
              initialRows={result.rows}
              initialPage={result.page}
              totalPages={result.totalPages}
              query={rawQuery}
              filters={{
                sort: parsed.data.sort,
                category: parsed.data.category,
                author: parsed.data.author,
                from: parsed.data.from,
                to: parsed.data.to,
              }}
            />
          </>
        );
      } else {
        body = (
          <EmptyState
            title={`نتیجه‌ای برای «${rawQuery}» یافت نشد`}
            description="املای عبارت را بررسی کنید یا از کلمات کلیدی دیگری استفاده کنید."
          />
        );
      }
    }
  }

  const currentSort = parsed.success ? parsed.data.sort : "relevance";
  const currentCategory = parsed.success ? parsed.data.category : undefined;
  const currentAuthor = parsed.success ? parsed.data.author : undefined;

  return (
    <div className="editorial-search-page">
      <Breadcrumb items={[{ label: "جستجو" }]} />
      <header className="editorial-listing-header"><p>آرشیو رسانه</p><h1>جستجو</h1></header>

      <form method="get" role="search" className="editorial-search-form">
        <div className="sm:col-span-2">
          <label htmlFor="s-q" className="mb-1 block text-xs font-medium">عبارت جستجو</label>
          <input id="s-q" type="search" name="q" defaultValue={rawQuery} placeholder="جستجو…" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
        </div>
        <div>
          <label htmlFor="s-category" className="mb-1 block text-xs font-medium">دسته‌بندی</label>
          <select id="s-category" name="category" defaultValue={currentCategory ?? ""} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
            <option value="">همه دسته‌ها</option>
            {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="s-author" className="mb-1 block text-xs font-medium">نویسنده</label>
          <select id="s-author" name="author" defaultValue={currentAuthor ?? ""} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
            <option value="">همه نویسندگان</option>
            {authors.map((author) => (
              <option key={author.slug} value={author.slug}>{author.displayName || author.user.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="s-sort" className="mb-1 block text-xs font-medium">مرتب‌سازی</label>
          <select id="s-sort" name="sort" defaultValue={currentSort} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
            <option value="relevance">مرتبط‌ترین</option>
            <option value="newest">جدیدترین</option>
          </select>
        </div>
        <div>
          <label htmlFor="s-from" className="mb-1 block text-xs font-medium">از تاریخ</label>
          <input id="s-from" type="date" name="from" defaultValue={parsed.success ? parsed.data.from : ""} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
        </div>
        <div>
          <label htmlFor="s-to" className="mb-1 block text-xs font-medium">تا تاریخ</label>
          <input id="s-to" type="date" name="to" defaultValue={parsed.success ? parsed.data.to : ""} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
        </div>
        <div className="sm:col-span-4">
          <button type="submit" className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
            جستجو
          </button>
        </div>
      </form>

      {body}
    </div>
  );
}

export const dynamic = "force-dynamic";
