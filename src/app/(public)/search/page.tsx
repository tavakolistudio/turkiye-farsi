import { headers } from "next/headers";
import { publicSiteService } from "@/server/services/public-site.service";
import { searchService, searchQuerySchema } from "@/server/services/search.service";
import { rateLimit } from "@/server/api/rate-limit";
import { ArticleCard } from "@/components/public/article-card";
import { Breadcrumb, EmptyState, Pagination } from "@/components/public/ui";
import { routes } from "@/lib/public-links";
import { toPersianDigits } from "@/lib/dates";
import { buildMetadata } from "@/lib/seo/metadata";

// Search result pages are intentionally kept out of the index.
export const metadata = buildMetadata({
  title: "جستجو",
  description: "جستجو در اخبار و مطالب ترکیه فارسی.",
  path: routes.search(),
  noindex: true,
});

type Props = {
  searchParams: Promise<{ q?: string; page?: string; sort?: string; category?: string }>;
};

export default async function SearchPage({ searchParams }: Props) {
  const sp = await searchParams;
  const rawQuery = (sp.q ?? "").trim();
  const [categories] = await Promise.all([publicSiteService.navCategories()]);

  // Validate the incoming query; invalid/short queries just show a prompt.
  const parsed = searchQuerySchema.safeParse({
    q: rawQuery,
    page: sp.page,
    sort: sp.sort,
    category: sp.category,
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
            <div>
              {result.rows.map((a) => <ArticleCard key={a.id} article={a} variant="list" />)}
            </div>
            <Pagination
              page={result.page}
              totalPages={result.totalPages}
              basePath={routes.search()}
              params={{ q: rawQuery, sort: parsed.data.sort, category: parsed.data.category }}
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

  return (
    <div>
      <Breadcrumb items={[{ label: "جستجو" }]} />
      <h1 className="mb-6 text-2xl font-extrabold">جستجو</h1>

      <form method="get" role="search" className="mb-8 grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-4">
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
          <label htmlFor="s-sort" className="mb-1 block text-xs font-medium">مرتب‌سازی</label>
          <select id="s-sort" name="sort" defaultValue={currentSort} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
            <option value="relevance">مرتبط‌ترین</option>
            <option value="newest">جدیدترین</option>
          </select>
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
