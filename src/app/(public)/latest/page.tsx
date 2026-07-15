import Link from "next/link";
import { Breadcrumb } from "@/components/public/page-parts";
import { PublicPagination } from "@/components/public/pagination";
import { formatJalali } from "@/lib/dates";
import { publicListSchema } from "@/lib/validations/public";
import { publicContentService } from "@/server/services/public-content.service";
export default async function LatestPage({ searchParams }: PageProps<"/latest">) { const query = publicListSchema.parse(await searchParams); const result = await publicContentService.listArticles({ ...query, sort: "latest" }); return <div className="public-container"><Breadcrumb items={[{ label: "آخرین اخبار" }]} /><header className="listing-header"><h1>آخرین اخبار</h1><p>تازه‌ترین مطالب منتشرشده به ترتیب زمان</p></header><ol className="latest-timeline">{result.rows.map((article) => <li key={article.id}><time>{article.publishedAt ? formatJalali(article.publishedAt, "HH:mm") : "—"}</time><div>{article.isBreaking ? <strong>فوری</strong> : null}{article.primaryCategory ? <Link href={`/category/${article.primaryCategory.slug}`}>{article.primaryCategory.name}</Link> : null}<h2><Link href={`/news/${article.slug}`}>{article.title}</Link></h2></div></li>)}</ol><PublicPagination page={result.meta.page} totalPages={result.meta.totalPages} pathname="/latest" /></div>; }
