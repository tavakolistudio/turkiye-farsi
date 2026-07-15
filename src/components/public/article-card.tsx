import Image from "next/image";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { formatJalali } from "@/lib/dates";
import { publicArticleCardSelect } from "@/server/data/article.repo";

export type PublicArticleCard = Prisma.ArticleGetPayload<{ select: typeof publicArticleCardSelect }> & { rangeViews?: number };

function MediaImage({ article, priority = false }: { article: PublicArticleCard; priority?: boolean }) {
  const image = article.featuredImage;
  if (!image?.publicUrl) return <div className="article-card-placeholder" aria-hidden />;
  const alt = image.alt || article.title;
  const width = image.width || 1200;
  const height = image.height || 675;
  if (image.publicUrl.startsWith("/")) return <Image src={image.publicUrl} alt={alt} width={width} height={height} priority={priority} sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" />;
  // Remote storage domains are deployment-configurable and not trusted for optimization.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={image.publicUrl} alt={alt} width={width} height={height} loading={priority ? "eager" : "lazy"} decoding="async" referrerPolicy="no-referrer" />;
}

export function ArticleCard({ article, featured = false, priority = false }: { article: PublicArticleCard; featured?: boolean; priority?: boolean }) {
  const publishedAt = article.publishedAt ? new Date(article.publishedAt) : null;
  return (
    <article className={featured ? "article-card article-card-featured" : "article-card"}>
      <Link href={`/news/${article.slug}`} className="article-card-media" tabIndex={-1}><MediaImage article={article} priority={priority} /></Link>
      <div className="article-card-content">
        {article.primaryCategory ? <Link className="article-kicker" href={`/category/${article.primaryCategory.slug}`}>{article.primaryCategory.name}</Link> : null}
        <h3><Link href={`/news/${article.slug}`}>{article.title}</Link></h3>
        {featured && article.summary ? <p>{article.summary}</p> : null}
        <div className="article-meta">
          <span>{article.author.profile?.displayName || article.author.name}</span>
          {publishedAt && !Number.isNaN(publishedAt.getTime()) ? <time dateTime={publishedAt.toISOString()}>{formatJalali(publishedAt)}</time> : null}
          {article.readingTime ? <span>{article.readingTime} دقیقه</span> : null}
          {typeof article.rangeViews === "number" ? <span>{article.rangeViews} بازدید</span> : null}
        </div>
      </div>
    </article>
  );
}

export function ArticleList({ articles, empty = "مطلبی برای نمایش وجود ندارد." }: { articles: PublicArticleCard[]; empty?: string }) {
  if (!articles.length) return <div className="public-empty"><h2>هنوز خبری نیست</h2><p>{empty}</p></div>;
  return <div className="article-grid">{articles.map((article) => <ArticleCard key={article.id} article={article} />)}</div>;
}
