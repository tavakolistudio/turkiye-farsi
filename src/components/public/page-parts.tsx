import Link from "next/link";
import { ArticleList, type PublicArticleCard } from "@/components/public/article-card";
import { PublicPagination } from "@/components/public/pagination";

export function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return <nav className="public-breadcrumb" aria-label="مسیر صفحه"><Link href="/">خانه</Link>{items.map((item, index) => <span key={`${item.label}-${index}`}>{item.href ? <Link href={item.href}>{item.label}</Link> : item.label}</span>)}</nav>;
}

export function ListingPage({ title, description, articles, meta, pathname, params, before }: {
  title: string;
  description?: string | null;
  articles: PublicArticleCard[];
  meta: { page: number; totalPages: number; total: number };
  pathname: string;
  params?: Record<string, string | undefined>;
  before?: React.ReactNode;
}) {
  return <div className="public-container"><Breadcrumb items={[{ label: title }]} /><header className="listing-header"><h1>{title}</h1>{description ? <p>{description}</p> : null}<span>{meta.total} مطلب منتشرشده</span></header>{before}<ArticleList articles={articles} /><PublicPagination page={meta.page} totalPages={meta.totalPages} pathname={pathname} params={params} /></div>;
}
