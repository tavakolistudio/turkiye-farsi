import { ListingPage } from "@/components/public/page-parts";
import { newsListSchema } from "@/lib/validations/public";
import { publicContentService } from "@/server/services/public-content.service";

export default async function NewsPage({ searchParams }: PageProps<"/news">) {
  const query = newsListSchema.parse(await searchParams);
  const [result, categories] = await Promise.all([publicContentService.listArticles(query), publicContentService.listCategories()]);
  const form = <form className="public-filters" action="/news"><input name="q" defaultValue={query.q} placeholder="جستجو در اخبار" aria-label="جستجو" /><select name="category" defaultValue={query.category || ""} aria-label="دسته‌بندی"><option value="">همه دسته‌ها</option>{categories.map((category) => <option key={category.slug} value={category.slug}>{category.name}</option>)}</select><select name="contentType" defaultValue={query.contentType || ""} aria-label="نوع محتوا"><option value="">همه انواع</option><option value="NEWS">خبر</option><option value="ANALYSIS">تحلیل</option><option value="GUIDE">راهنما</option><option value="VIDEO">ویدیو</option></select><select name="sort" defaultValue={query.sort} aria-label="مرتب‌سازی"><option value="latest">جدیدترین</option><option value="oldest">قدیمی‌ترین</option><option value="most-viewed">پربازدیدترین</option></select><button>اعمال</button></form>;
  return <ListingPage title="همه اخبار" articles={result.rows} meta={result.meta} pathname="/news" params={{ q: query.q, category: query.category, contentType: query.contentType, sort: query.sort }} before={form} />;
}
