import { publicSiteService } from "@/server/services/public-site.service";
import { ArticleCard, HeroLeadStory, SecondaryStoryCard } from "@/components/public/article-card";
import { EmptyState, SectionHeading } from "@/components/public/ui";
import { ImpactForIranians, LatestNewsList, MostViewedList } from "@/components/public/editorial-sections";
import { routes } from "@/lib/public-links";
import { siteConfig } from "@/lib/site-config";
import { buildMetadata } from "@/lib/seo/metadata";
import { siteSettingsService } from "@/server/services/site-settings.service";

export async function generateMetadata() {
  const publisher = await siteSettingsService.publisher();
  return buildMetadata({
    title: `${publisher.siteName || siteConfig.name} — اخبار و راهنمای ایرانیان ترکیه`,
    absoluteTitle: true,
    description: publisher.description || siteConfig.description,
    path: "/",
    fallbackImage: publisher.logo,
  });
}

export default async function HomePage() {
  const home = await publicSiteService.getHomepage();
  const hasAnything = home.hero || home.latest.length || home.editorPicks.length || home.categoryRails.length;

  if (!hasAnything) {
    return (
      <EmptyState
        title="هنوز خبری منتشر نشده است"
        description="به‌زودی جدیدترین اخبار و مطالب ترکیه فارسی در این صفحه نمایش داده می‌شود."
      />
    );
  }

  return (
    <div className="editorial-home">
      {home.hero && (
        <section className="homepage-lead-grid" aria-label="مهم‌ترین خبرها">
          <div className="homepage-lead"><HeroLeadStory article={home.hero} /></div>
          <div className="homepage-secondary">
            {home.subFeatures.slice(0, 4).map((article) => <SecondaryStoryCard key={article.id} article={article} />)}
          </div>
          <aside className="homepage-most-viewed" aria-labelledby="home-most-viewed">
            <SectionHeading title="پربازدیدها" href={routes.mostViewed()} />
            <MostViewedList articles={home.mostViewed} />
          </aside>
        </section>
      )}

      {home.latest.length > 0 && (
        <section className="homepage-latest" aria-labelledby="home-latest">
          <div id="home-latest"><SectionHeading title="آخرین اخبار" href={routes.latest()} /></div>
          <LatestNewsList articles={home.latest} />
        </section>
      )}

      {home.impactStory && <ImpactForIranians story={home.impactStory} />}

      {home.categoryRails.map((rail, index) => (
        <section key={rail.id} className="homepage-rail" aria-labelledby={`rail-${rail.id}`}>
          <div id={`rail-${rail.id}`}><SectionHeading title={rail.title} href={routes.category(rail.slug)} /></div>
          <div className={index % 2 === 0 ? "editorial-four-grid" : "editorial-rail-grid"}>
            {rail.articles.map((article, articleIndex) => (
              <ArticleCard
                key={article.id}
                article={article}
                variant={index % 2 === 1 && articleIndex === 0 ? "horizontal" : "vertical"}
              />
            ))}
          </div>
        </section>
      ))}

      {home.guides.length > 0 && (
        <section className="homepage-rail" aria-labelledby="home-guides">
          <div id="home-guides"><SectionHeading title="راهنماهای زندگی" href={`${routes.news()}?type=GUIDE`} /></div>
          <div className="editorial-four-grid">
            {home.guides.map((article) => <ArticleCard key={article.id} article={article} />)}
          </div>
        </section>
      )}

      {home.videos.length > 0 && (
        <section className="homepage-video" aria-labelledby="home-video">
          <div id="home-video"><SectionHeading title="ویدئو" href={`${routes.news()}?type=VIDEO`} /></div>
          <div className="editorial-four-grid">
            {home.videos.map((article) => <ArticleCard key={article.id} article={article} />)}
          </div>
        </section>
      )}

      {home.editorPicks.length > 0 && (
        <section className="homepage-rail" aria-labelledby="home-picks">
          <div id="home-picks"><SectionHeading title="منتخب سردبیر" /></div>
          <div className="editorial-three-grid">
            {home.editorPicks.slice(0, 3).map((article) => <ArticleCard key={article.id} article={article} />)}
          </div>
        </section>
      )}
    </div>
  );
}
