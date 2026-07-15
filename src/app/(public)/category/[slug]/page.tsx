import Link from "next/link";
import { notFound } from "next/navigation";
import { ListingPage } from "@/components/public/page-parts";
import { publicListSchema, publicSlugSchema } from "@/lib/validations/public";
import { publicContentService } from "@/server/services/public-content.service";
export default async function CategoryPage({ params, searchParams }: PageProps<"/category/[slug]">) { const slug = publicSlugSchema.safeParse((await params).slug); if (!slug.success) notFound(); const query = publicListSchema.parse(await searchParams); let result; try { result = await publicContentService.articlesByCategory(slug.data, query); } catch { notFound(); } const children = result.category.children.length ? <nav className="child-categories" aria-label="زیردسته‌ها">{result.category.children.map((child) => <Link key={child.slug} href={`/category/${child.slug}`}>{child.name}</Link>)}</nav> : null; return <ListingPage title={result.category.name} description={result.category.description} articles={result.rows} meta={result.meta} pathname={`/category/${slug.data}`} before={children} />; }
