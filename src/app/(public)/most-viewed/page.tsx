import Link from "next/link";
import { publicSiteService, type MostViewedWindow } from "@/server/services/public-site.service";
import { ArticleCard } from "@/components/public/article-card";
import { Breadcrumb, EmptyState } from "@/components/public/ui";
import { routes } from "@/lib/public-links";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "پربازدیدترین‌ها",
  description: "پربازدیدترین مطالب ترکیه فارسی در بازه‌های زمانی مختلف.",
  path: routes.mostViewed(),
});

const RANGES: { key: MostViewedWindow; label: string }[] = [
  { key: "today", label: "امروز" },
  { key: "week", label: "این هفته" },
  { key: "month", label: "این ماه" },
  { key: "all", label: "همه زمان‌ها" },
];

type Props = { searchParams: Promise<{ range?: string }> };

export default async function MostViewedPage({ searchParams }: Props) {
  const raw = (await searchParams).range;
  const range: MostViewedWindow = RANGES.some((r) => r.key === raw) ? (raw as MostViewedWindow) : "all";
  const rows = await publicSiteService.mostViewed(range, 24);

  return (
    <div>
      <Breadcrumb items={[{ label: "پربازدیدترین‌ها" }]} />
      <h1 className="mb-4 text-2xl font-extrabold">پربازدیدترین‌ها</h1>

      <div className="mb-6 flex flex-wrap gap-2" role="tablist" aria-label="بازه زمانی">
        {RANGES.map((r) => (
          <Link
            key={r.key}
            href={r.key === "all" ? routes.mostViewed() : `${routes.mostViewed()}?range=${r.key}`}
            role="tab"
            aria-selected={r.key === range}
            className={`rounded-full border px-4 py-1.5 text-sm ${
              r.key === range ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-accent"
            }`}
          >
            {r.label}
          </Link>
        ))}
      </div>

      {rows.length ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((a) => <ArticleCard key={a.id} article={a} />)}
        </div>
      ) : (
        <EmptyState
          title="هنوز آماری برای این بازه ثبت نشده است"
          description="پربازدیدترین مطالب پس از ثبت بازدید کاربران در این بخش نمایش داده می‌شوند."
        />
      )}
    </div>
  );
}
