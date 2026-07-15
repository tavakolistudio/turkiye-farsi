/* eslint-disable @next/next/no-img-element -- advertisement media is supplied by the configured ad record */
import Link from "next/link";
import { ArticleCard, ArticleList } from "@/components/public/article-card";
import { getHomepageCached } from "@/server/services/public-cache";

export const revalidate = 60;

export default async function HomePage() {
  const data = await getHomepageCached();
  const [hero, ...secondary] = data.hero;
  return (
    <div className="public-container home-page">
      <h1 className="sr-only">ترکیه فارسی؛ اخبار و راهنمای زندگی در ترکیه</h1>
      {hero ? (
        <section className="hero-grid" aria-label="مهم‌ترین اخبار">
          <ArticleCard article={hero} featured priority />
          <div className="hero-secondary">{secondary.slice(0, 4).map((article) => <ArticleCard key={article.id} article={article} />)}</div>
        </section>
      ) : <div className="public-empty"><h2>تیتر اصلی هنوز انتخاب نشده است</h2><p>پس از انتشار و انتخاب خبر اصلی، این بخش نمایش داده می‌شود.</p></div>}

      <HomeSection title="آخرین اخبار" href="/latest"><ArticleList articles={data.latest.slice(0, 8)} /></HomeSection>
      <HomeSection title="اخبار فوری" href="/breaking"><ArticleList articles={data.breaking} /></HomeSection>
      <HomeSection title="اخبار ترکیه" href="/news"><ArticleList articles={data.turkey} /></HomeSection>
      {data.categorySections.map((section) => <HomeSection key={section.id} title={section.title} href={section.articles[0]?.primaryCategory ? `/category/${section.articles[0].primaryCategory.slug}` : "/news"}><ArticleList articles={section.articles} /></HomeSection>)}
      <HomeSection title="یالووا" href="/news"><ArticleList articles={data.yalova} /></HomeSection>
      <HomeSection title="پربازدیدترین‌ها" href="/most-viewed"><ArticleList articles={data.viewed} /></HomeSection>
      <HomeSection title="منتخب سردبیر" href="/news?sort=latest"><ArticleList articles={data.editors} /></HomeSection>
      <HomeSection title="راهنماهای کاربردی" href="/news?contentType=GUIDE"><ArticleList articles={data.guides} /></HomeSection>
      {data.ads.filter((ad) => ad.imageUrl && ad.linkUrl).map((ad) => <aside key={ad.id} className="public-ad" aria-label="تبلیغات"><a href={ad.linkUrl!} target="_blank" rel="noopener noreferrer sponsored"><img src={ad.imageUrl!} alt={ad.name} loading="lazy" /></a></aside>)}
    </div>
  );
}

function HomeSection({ title, href, children }: { title: string; href: string; children: React.ReactNode }) {
  return <section className="home-section"><div className="section-heading"><h2>{title}</h2><Link href={href}>مشاهده همه</Link></div>{children}</section>;
}
