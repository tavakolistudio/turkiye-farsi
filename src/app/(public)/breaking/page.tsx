import { ListingPage } from "@/components/public/page-parts";
import { publicListSchema } from "@/lib/validations/public";
import { publicContentService } from "@/server/services/public-content.service";
export default async function BreakingPage({ searchParams }: PageProps<"/breaking">) { const query = publicListSchema.parse(await searchParams); const result = await publicContentService.listBreaking(query); return <ListingPage title="اخبار فوری" description="فقط خبرهای فوری منتشرشده" articles={result.rows} meta={result.meta} pathname="/breaking" />; }
