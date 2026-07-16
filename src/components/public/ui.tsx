import Link from "next/link";
import { toPersianDigits } from "@/lib/dates";
import { routes } from "@/lib/public-links";

/** Section heading with optional "see all" link, used on the homepage rails. */
export function SectionHeading({
  title,
  href,
  accent = false,
}: {
  title: string;
  href?: string;
  accent?: boolean;
}) {
  return (
    <div className={`editorial-section-heading ${accent ? "editorial-section-heading-breaking" : ""}`}>
      <h2>
        {title}
      </h2>
      {href && (
        <Link href={href}>
          مشاهده همه
        </Link>
      )}
    </div>
  );
}

/** Accessible breadcrumb trail. */
export function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="مسیر" className="mb-4 text-sm text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-1.5">
        <li>
          <Link href={routes.home()} className="hover:text-primary">خانه</Link>
        </li>
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-1.5">
            <span aria-hidden="true">/</span>
            {item.href && i < items.length - 1 ? (
              <Link href={item.href} className="hover:text-primary">{item.label}</Link>
            ) : (
              <span aria-current="page" className="text-foreground">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Honest empty state — shown when a section/list genuinely has no content. */
export function EmptyState({
  title = "محتوایی برای نمایش وجود ندارد",
  description,
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="editorial-empty-state">
      <p className="font-semibold">{title}</p>
      {description && <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}

/** Link-based pagination that preserves existing query params. */
export function Pagination({
  page,
  totalPages,
  basePath,
  params = {},
}: {
  page: number;
  totalPages: number;
  basePath: string;
  params?: Record<string, string | undefined>;
}) {
  if (totalPages <= 1) return null;

  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  const pages: number[] = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <nav aria-label="صفحه‌بندی" className="mt-8 flex items-center justify-center gap-1.5">
      {page > 1 && (
        <Link href={href(page - 1)} rel="prev" className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent">
          قبلی
        </Link>
      )}
      {start > 1 && <span className="px-1 text-muted-foreground">…</span>}
      {pages.map((p) => (
        <Link
          key={p}
          href={href(p)}
          aria-current={p === page ? "page" : undefined}
          className={`min-w-9 rounded-md border px-3 py-1.5 text-center text-sm ${
            p === page ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-accent"
          }`}
        >
          {toPersianDigits(p)}
        </Link>
      ))}
      {end < totalPages && <span className="px-1 text-muted-foreground">…</span>}
      {page < totalPages && (
        <Link href={href(page + 1)} rel="next" className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent">
          بعدی
        </Link>
      )}
    </nav>
  );
}
