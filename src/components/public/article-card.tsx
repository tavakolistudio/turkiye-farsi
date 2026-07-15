import Link from "next/link";
import type { PublicCard } from "@/server/data/article.repo";
import { routes } from "@/lib/public-links";
import { PostImage } from "./post-image";
import { ArticleMeta, Byline, CategoryChip } from "./article-meta";

type Variant = "default" | "hero" | "compact" | "list";

/**
 * The single article card used across the site. Variants change layout only;
 * data and links are identical, so behaviour stays consistent everywhere.
 */
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

  if (variant === "compact") {
    return (
      <article className="flex gap-3 py-3">
        <Link href={href} className="relative block h-16 w-24 shrink-0 overflow-hidden rounded-md" tabIndex={-1} aria-hidden="true">
          <PostImage src={article.featuredImage?.publicUrl} alt={article.featuredImage?.alt ?? article.title} sizes="96px" />
        </Link>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold leading-6">
            <Link href={href} className="hover:text-primary">{article.title}</Link>
          </h3>
          <ArticleMeta publishedAt={article.publishedAt} className="mt-1" />
        </div>
      </article>
    );
  }

  if (variant === "list") {
    return (
      <article className="flex flex-col gap-3 border-b border-border py-5 sm:flex-row sm:gap-5">
        <Link href={href} className="relative block aspect-[16/10] w-full overflow-hidden rounded-lg sm:w-64 sm:shrink-0" tabIndex={-1} aria-hidden="true">
          <PostImage src={article.featuredImage?.publicUrl} alt={article.featuredImage?.alt ?? article.title} sizes="(max-width: 640px) 100vw, 256px" />
          {article.isBreaking && <BreakingTag />}
        </Link>
        <div className="min-w-0 flex-1">
          <CategoryChip category={article.primaryCategory} />
          <h3 className="mt-2 text-lg font-bold leading-7">
            <Link href={href} className="hover:text-primary">{article.title}</Link>
          </h3>
          {article.summary && <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{article.summary}</p>}
          <div className="mt-2 flex items-center gap-3">
            <Byline author={article.author} />
            <ArticleMeta publishedAt={article.publishedAt} readingTime={article.readingTime} />
          </div>
        </div>
      </article>
    );
  }

  if (variant === "hero") {
    return (
      <article className="group relative overflow-hidden rounded-2xl">
        <Link href={href} className="relative block aspect-[16/9] w-full overflow-hidden">
          <PostImage src={article.featuredImage?.publicUrl} alt={article.featuredImage?.alt ?? article.title} sizes="(max-width: 1024px) 100vw, 66vw" priority={priority} className="transition-transform duration-500 group-hover:scale-105" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
          {article.isBreaking && <BreakingTag />}
        </Link>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 p-5 text-white">
          <CategoryChip category={article.primaryCategory} />
          <h2 className="mt-2 text-xl font-extrabold leading-8 sm:text-2xl md:text-3xl">
            <Link href={href} className="pointer-events-auto hover:underline">{article.title}</Link>
          </h2>
          {article.summary && <p className="mt-2 line-clamp-2 max-w-2xl text-sm text-white/85">{article.summary}</p>}
        </div>
      </article>
    );
  }

  // default vertical card
  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card">
      <Link href={href} className="relative block aspect-[16/10] w-full overflow-hidden">
        <PostImage src={article.featuredImage?.publicUrl} alt={article.featuredImage?.alt ?? article.title} sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw" priority={priority} className="transition-transform duration-500 group-hover:scale-105" />
        {article.isBreaking && <BreakingTag />}
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <CategoryChip category={article.primaryCategory} />
        <h3 className="mt-2 text-base font-bold leading-7">
          <Link href={href} className="hover:text-primary">{article.title}</Link>
        </h3>
        {article.summary && <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{article.summary}</p>}
        <div className="mt-auto pt-3">
          <ArticleMeta publishedAt={article.publishedAt} readingTime={article.readingTime} />
        </div>
      </div>
    </article>
  );
}

function BreakingTag() {
  return (
    <span className="absolute right-3 top-3 z-10 rounded bg-breaking px-2 py-0.5 text-xs font-bold text-breaking-foreground">
      فوری
    </span>
  );
}
