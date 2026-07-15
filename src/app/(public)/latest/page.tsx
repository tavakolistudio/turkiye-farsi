import Link from "next/link";
import { publicSiteService } from "@/server/services/public-site.service";
import { Breadcrumb, EmptyState, Pagination } from "@/components/public/ui";
import { CategoryChip } from "@/components/public/article-meta";
import { routes } from "@/lib/public-links";
import { buildMetadata } from "@/lib/seo/metadata";
import { formatJalali, toIso, toPersianDigits } from "@/lib/dates";

export const metadata = buildMetadata({
  title: "آخرین اخبار",
  description: "جدیدترین اخبار و مطالب منتشرشده در ترکیه فارسی، به‌ترتیب زمان انتشار.",
  path: routes.latest(),
});

type Props = { searchParams: Promise<{ page?: string }> };
const PAGE_SIZE = 20;

export default async function LatestPage({ searchParams }: Props) {
  const n = Number((await searchParams).page);
  const page = Number.isInteger(n) && n > 0 ? n : 1;
  const { rows, total } = await publicSiteService.latest((page - 1) * PAGE_SIZE, PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <Breadcrumb items={[{ label: "آخرین اخبار" }]} />
      <h1 className="mb-6 text-2xl font-extrabold">آخرین اخبار</h1>

      {rows.length ? (
        <>
          <ol className="relative space-y-6 border-r-2 border-border pr-5">
            {rows.map((a) => {
              const date = a.publishedAt ? new Date(a.publishedAt) : null;
              return (
                <li key={a.id} className="relative">
                  <span className="absolute right-[-1.6rem] top-1.5 h-3 w-3 rounded-full bg-primary" aria-hidden="true" />
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {date && <time dateTime={toIso(date)}>{formatJalali(date, "d MMMM yyyy — HH:mm")}</time>}
                    <CategoryChip category={a.primaryCategory} />
                    {a.isBreaking && <span className="rounded bg-breaking px-1.5 py-0.5 font-bold text-breaking-foreground">فوری</span>}
                  </div>
                  <h2 className="mt-1 text-lg font-bold leading-7">
                    <Link href={routes.article(a.slug)} className="hover:text-primary">{a.title}</Link>
                  </h2>
                  {a.summary && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{a.summary}</p>}
                </li>
              );
            })}
          </ol>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            {toPersianDigits(total)} مطلب منتشرشده
          </p>
          <Pagination page={page} totalPages={totalPages} basePath={routes.latest()} />
        </>
      ) : (
        <EmptyState title="هنوز خبری منتشر نشده است" />
      )}
    </div>
  );
}
