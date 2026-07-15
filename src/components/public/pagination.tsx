import Link from "next/link";

export function PublicPagination({ page, totalPages, pathname, params = {} }: { page: number; totalPages: number; pathname: string; params?: Record<string, string | undefined> }) {
  if (totalPages <= 1) return null;
  const href = (nextPage: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value) query.set(key, value);
    query.set("page", String(nextPage));
    return `${pathname}?${query}`;
  };
  return <nav className="public-pagination" aria-label="صفحه‌بندی">{page > 1 ? <Link href={href(page - 1)}>صفحه قبل</Link> : <span />}
    <span>صفحه {page} از {totalPages}</span>{page < totalPages ? <Link href={href(page + 1)}>صفحه بعد</Link> : <span />}</nav>;
}
