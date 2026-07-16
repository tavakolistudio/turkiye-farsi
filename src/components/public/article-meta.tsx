import Link from "next/link";
import { formatJalali, toIso, toPersianDigits } from "@/lib/dates";
import { routes } from "@/lib/public-links";

/** Small inline metadata row: published date + optional reading time. */
export function ArticleMeta({
  publishedAt,
  readingTime,
  className = "",
}: {
  publishedAt: Date | string | null;
  readingTime?: number | null;
  className?: string;
}) {
  const date = publishedAt ? new Date(publishedAt) : null;
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground ${className}`}>
      {date && (
        <time dateTime={toIso(date)}>{formatJalali(date)}</time>
      )}
      {readingTime ? (
        <span>{toPersianDigits(readingTime)} دقیقه مطالعه</span>
      ) : null}
    </div>
  );
}

/** Category chip that links to the category archive. */
export function CategoryChip({
  category,
}: {
  category: { name: string; slug: string } | null;
}) {
  if (!category) return null;
  return (
    <Link
      href={routes.category(category.slug)}
      className="editorial-kicker"
    >
      {category.name}
    </Link>
  );
}

/** Author byline linking to the public author page (only when public). */
export function Byline({
  author,
  className = "",
}: {
  author?: {
    name: string;
    profile?: { slug: string; displayName: string | null; isPublic?: boolean } | null;
  } | null;
  className?: string;
}) {
  if (!author) return null;
  const profile = author.profile;
  const display = profile?.displayName || author.name;
  if (profile?.slug && profile.isPublic !== false) {
    return (
      <Link href={routes.author(profile.slug)} className={`text-sm font-medium hover:text-primary ${className}`}>
        {display}
      </Link>
    );
  }
  return <span className={`text-sm font-medium ${className}`}>{display}</span>;
}
