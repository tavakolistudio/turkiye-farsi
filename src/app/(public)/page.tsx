import Link from "next/link";
import type { Metadata } from "next";
import { publicSiteService } from "@/server/services/public-site.service";
import { ArticleCard } from "@/components/public/article-card";
import { SectionHeading, EmptyState } from "@/components/public/ui";
import { routes } from "@/lib/public-links";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const home = await publicSiteService.getHomepage();

  const hasAnything =
    home.hero ||
    home.latest.length ||
    home.breaking.length ||
    home.editorPicks.length ||
    home.mostViewed.length ||
    home.categoryRails.length;

  if (!hasAnything) {
    return (
      <EmptyState
        title="هنوز خبری منتشر نشده است"
        description="به‌زودی جدیدترین اخبار و مطالب ترکیه فارسی در این صفحه نمایش داده می‌شود."
      />
    );
  }

  return (
    <div className="space-y-12">
      {/* Hero + sub-features */}
      {home.hero && (
        <section aria-label="مطلب ویژه" className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ArticleCard article={home.hero} variant="hero" priority />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            {home.subFeatures.length ? (
              home.subFeatures.map((a) => <ArticleCard key={a.id} article={a} variant="compact" />)
            ) : (
              <EmptyState title="مطلب دیگری موجود نیست" />
            )}
          </div>
        </section>
      )}

      <div className="grid gap-12 lg:grid-cols-3">
        <div className="space-y-12 lg:col-span-2">
          {/* Latest */}
          <section aria-labelledby="home-latest">
            <div id="home-latest">
              <SectionHeading title="آخرین اخبار" href={routes.latest()} />
            </div>
            {home.latest.length ? (
              <div className="grid gap-5 sm:grid-cols-2">
                {home.latest.map((a) => <ArticleCard key={a.id} article={a} />)}
              </div>
            ) : (
              <EmptyState />
            )}
          </section>

          {/* Editor picks */}
          {home.editorPicks.length > 0 && (
            <section aria-labelledby="home-picks">
              <div id="home-picks">
                <SectionHeading title="منتخب سردبیر" />
              </div>
              <div className="grid gap-5 sm:grid-cols-3">
                {home.editorPicks.slice(0, 3).map((a) => <ArticleCard key={a.id} article={a} />)}
              </div>
            </section>
          )}

          {/* Category rails */}
          {home.categoryRails.map((rail) => (
            <section key={rail.id} aria-label={rail.title}>
              <SectionHeading title={rail.title} href={routes.category(rail.slug)} />
              <div className="grid gap-5 sm:grid-cols-2">
                {rail.articles.map((a) => <ArticleCard key={a.id} article={a} variant="list" />)}
              </div>
            </section>
          ))}
        </div>

        {/* Sidebar */}
        <aside className="space-y-12">
          {home.breaking.length > 0 && (
            <section aria-label="اخبار فوری">
              <SectionHeading title="اخبار فوری" href={routes.breaking()} accent />
              <div className="divide-y divide-border rounded-xl border border-border px-4">
                {home.breaking.slice(0, 5).map((a) => <ArticleCard key={a.id} article={a} variant="compact" />)}
              </div>
            </section>
          )}

          <section aria-label="پربازدیدترین‌ها">
            <SectionHeading title="پربازدیدترین‌ها" href={routes.mostViewed()} />
            {home.mostViewed.length ? (
              <ol className="divide-y divide-border rounded-xl border border-border px-4">
                {home.mostViewed.slice(0, 5).map((a, i) => (
                  <li key={a.id} className="flex items-start gap-3 py-3">
                    <span className="mt-1 text-lg font-extrabold text-primary/40">{i + 1}</span>
                    <h3 className="text-sm font-semibold leading-6">
                      <Link href={routes.article(a.slug)} className="hover:text-primary">{a.title}</Link>
                    </h3>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState title="هنوز آماری ثبت نشده است" />
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
