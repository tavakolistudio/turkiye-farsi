import Link from "next/link";
import type { PublicCard } from "@/server/data/article.repo";
import { formatJalali, toIso, toPersianDigits } from "@/lib/dates";
import { routes } from "@/lib/public-links";
import { ArticleCard } from "./article-card";
import { ArticleMeta, CategoryChip } from "./article-meta";

export type ImpactStory = {
  title?: string;
  slug?: string;
  whyItMatters: string | null;
  whoIsAffected: string | null;
  whatToDo: string | null;
};

export function ImpactForIranians({ story }: { story: ImpactStory }) {
  const blocks = [
    ["چرا این خبر مهم است؟", story.whyItMatters],
    ["چه کسانی تحت تأثیر قرار می‌گیرند؟", story.whoIsAffected],
    ["اکنون چه کاری باید انجام دهند؟", story.whatToDo],
  ].filter((item): item is [string, string] => Boolean(item[1]));
  if (!blocks.length) return null;

  return (
    <section className="impact-for-iranians" aria-labelledby="impact-title">
      <div className="impact-heading">
        <p>راهنمای کاربردی ترکیه فارسی</p>
        <h2 id="impact-title">این خبر چه تأثیری روی شما دارد؟</h2>
        {story.title && story.slug && <Link href={routes.article(story.slug)}>{story.title}</Link>}
      </div>
      <div className="impact-grid">
        {blocks.map(([label, value], index) => (
          <div key={label}>
            <span aria-hidden="true">{toPersianDigits(index + 1)}</span>
            <h3>{label}</h3>
            <p>{value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function MostViewedList({ articles }: { articles: PublicCard[] }) {
  return (
    <ol className="most-viewed-list">
      {articles.slice(0, 5).map((article, index) => (
        <li key={article.id}>
          <span className="most-viewed-rank">{toPersianDigits(index + 1)}</span>
          <div>
            <CategoryChip category={article.primaryCategory} />
            <h3><Link href={routes.article(article.slug)}>{article.title}</Link></h3>
            <ArticleMeta publishedAt={article.publishedAt} />
          </div>
        </li>
      ))}
    </ol>
  );
}

export function LatestNewsList({ articles }: { articles: PublicCard[] }) {
  return (
    <div className="latest-news-list">
      {articles.map((article) => <ArticleCard key={article.id} article={article} variant="horizontal" />)}
    </div>
  );
}

export function RelatedArticles({ articles }: { articles: PublicCard[] }) {
  if (!articles.length) return null;
  return (
    <section className="related-articles" aria-labelledby="related-heading">
      <div className="editorial-section-heading"><h2 id="related-heading">مطالب مرتبط</h2></div>
      <div className="editorial-three-grid">
        {articles.slice(0, 3).map((article) => <ArticleCard key={article.id} article={article} />)}
      </div>
    </section>
  );
}

type Source = {
  sourceUrl: string | null;
  sourceTitle: string | null;
  accessedAt: Date | string | null;
  source: { name: string } | null;
};

export function ArticleSources({ sources }: { sources: Source[] }) {
  if (!sources.length) return null;
  return (
    <section className="article-sources-editorial" aria-labelledby="article-sources">
      <h2 id="article-sources">منابع</h2>
      <ol>
        {sources.map((source, index) => (
          <li key={`${source.sourceUrl ?? source.sourceTitle}-${index}`}>
            {source.sourceUrl ? (
              <a href={source.sourceUrl} target="_blank" rel="noopener noreferrer">
                {source.sourceTitle || source.source?.name || source.sourceUrl}
              </a>
            ) : <span>{source.sourceTitle || source.source?.name}</span>}
            {source.accessedAt && (
              <small>تاریخ دسترسی: <time dateTime={toIso(new Date(source.accessedAt))}>{formatJalali(new Date(source.accessedAt))}</time></small>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

type Correction = {
  title: string;
  description: string;
  correctionType: string;
  publishedAt: Date | string | null;
};

const CORRECTION_LABELS: Record<string, string> = {
  MINOR: "اصلاح جزئی",
  MAJOR: "اصلاح مهم",
  RETRACTION: "بازپس‌گیری",
  UPDATE: "به‌روزرسانی",
};

export function ArticleCorrection({ corrections }: { corrections: Correction[] }) {
  if (!corrections.length) return null;
  return (
    <section className="article-correction-editorial" aria-labelledby="article-corrections">
      <h2 id="article-corrections">اصلاحیه‌ها</h2>
      {corrections.map((correction, index) => (
        <article key={`${correction.title}-${index}`}>
          <div>
            <strong>{CORRECTION_LABELS[correction.correctionType] ?? "اصلاح"}</strong>
            {correction.publishedAt && <time dateTime={toIso(new Date(correction.publishedAt))}>{formatJalali(new Date(correction.publishedAt))}</time>}
          </div>
          <h3>{correction.title}</h3>
          <p>{correction.description}</p>
        </article>
      ))}
    </section>
  );
}
