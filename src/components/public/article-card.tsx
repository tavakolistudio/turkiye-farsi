import Link from "next/link";
import type { PublicCard } from "@/server/data/article.repo";
import { routes } from "@/lib/public-links";
import { PostImage } from "./post-image";
import { ArticleMeta, Byline, CategoryChip } from "./article-meta";

type Variant = "default" | "hero" | "compact" | "list" | "vertical" | "horizontal" | "image-less";

export function ArticleCard({
  article,
  variant = "default",
  priority = false,
}: {
  article: PublicCard;
  variant?: Variant;
  priority?: boolean;
}) {
  const href = routes.article(article.slug);
  const mode = variant === "default" ? "vertical" : variant === "list" ? "horizontal" : variant;

  if (mode === "compact" || mode === "image-less") {
    return (
      <article className="editorial-card editorial-card-compact">
        <div className="min-w-0">
          <CategoryChip category={article.primaryCategory} />
          <h3><Link href={href}>{article.title}</Link></h3>
          <ArticleMeta publishedAt={article.publishedAt} readingTime={mode === "image-less" ? article.readingTime : undefined} />
        </div>
        {mode === "compact" && article.featuredImage?.publicUrl && (
          <Link href={href} className="editorial-card-thumb relative" tabIndex={-1} aria-hidden="true">
            <PostImage src={article.featuredImage.publicUrl} alt="" sizes="104px" />
          </Link>
        )}
      </article>
    );
  }

  if (mode === "horizontal") {
    return (
      <article className="editorial-card editorial-card-horizontal">
        {article.featuredImage?.publicUrl && (
          <Link href={href} className="editorial-card-media relative" tabIndex={-1} aria-hidden="true">
            <PostImage src={article.featuredImage.publicUrl} alt="" sizes="(max-width: 640px) 34vw, 260px" priority={priority} />
          </Link>
        )}
        <div className="editorial-card-copy">
          <CategoryChip category={article.primaryCategory} />
          <h3><Link href={href}>{article.title}</Link></h3>
          {article.summary && <p>{article.summary}</p>}
          <div className="editorial-card-byline">
            <Byline author={article.author} />
            <ArticleMeta publishedAt={article.publishedAt} readingTime={article.readingTime} />
          </div>
        </div>
      </article>
    );
  }

  if (mode === "hero") {
    return (
      <article className="editorial-card editorial-card-lead">
        <Link href={href} className="editorial-card-media relative">
          <PostImage
            src={article.featuredImage?.publicUrl}
            alt={article.featuredImage?.alt ?? article.title}
            sizes="(max-width: 900px) 100vw, 50vw"
            priority={priority}
          />
          {article.isBreaking && <BreakingTag />}
        </Link>
        <div className="editorial-card-copy">
          <CategoryChip category={article.primaryCategory} />
          <h2><Link href={href}>{article.title}</Link></h2>
          {article.summary && <p>{article.summary}</p>}
          <ArticleMeta publishedAt={article.publishedAt} readingTime={article.readingTime} />
        </div>
      </article>
    );
  }

  return (
    <article className="editorial-card editorial-card-vertical">
      <Link href={href} className="editorial-card-media relative">
        <PostImage
          src={article.featuredImage?.publicUrl}
          alt={article.featuredImage?.alt ?? article.title}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          priority={priority}
        />
        {article.isBreaking && <BreakingTag />}
      </Link>
      <div className="editorial-card-copy">
        <CategoryChip category={article.primaryCategory} />
        <h3><Link href={href}>{article.title}</Link></h3>
        {article.summary && <p>{article.summary}</p>}
        <ArticleMeta publishedAt={article.publishedAt} readingTime={article.readingTime} />
      </div>
    </article>
  );
}

export function HeroLeadStory({ article }: { article: PublicCard }) {
  return <ArticleCard article={article} variant="hero" priority />;
}

export function SecondaryStoryCard({ article }: { article: PublicCard }) {
  return <ArticleCard article={article} variant="compact" />;
}

export function CompactArticleCard({ article }: { article: PublicCard }) {
  return <ArticleCard article={article} variant="compact" />;
}

export function HorizontalArticleCard({ article }: { article: PublicCard }) {
  return <ArticleCard article={article} variant="horizontal" />;
}

function BreakingTag() {
  return <span className="editorial-breaking-tag">فوری</span>;
}
