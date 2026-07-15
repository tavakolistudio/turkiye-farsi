import { notFound } from "next/navigation";
import { ListingPage } from "@/components/public/page-parts";
import { publicListSchema, publicSlugSchema } from "@/lib/validations/public";
import { publicContentService } from "@/server/services/public-content.service";
export default async function TagPage({ params, searchParams }: PageProps<"/tag/[slug]">) { const slug = publicSlugSchema.safeParse((await params).slug); if (!slug.success) notFound(); const query = publicListSchema.parse(await searchParams); let result; try { result = await publicContentService.articlesByTag(slug.data, query); } catch { notFound(); } return <ListingPage title={`برچسب: ${result.tag.name}`} description={result.tag.description} articles={result.rows} meta={result.meta} pathname={`/tag/${slug.data}`} />; }
