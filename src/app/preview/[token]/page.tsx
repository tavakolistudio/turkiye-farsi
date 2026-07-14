import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { previewService } from "@/server/services/preview.service";
import { ArticleBody } from "@/components/content/article-body";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "پیش‌نمایش امن مطلب",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default async function PreviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const preview = await previewService.resolve(token).catch(() => null);
  if (!preview) notFound();
  const { article } = preview;
  return (
    <main className="mx-auto max-w-4xl px-5 py-10" dir="rtl">
      <div className="mb-6 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
        پیش‌نمایش خصوصی — این صفحه منتشر نشده و نباید به اشتراک عمومی گذاشته شود.
      </div>
      <article>
        <p className="text-sm text-muted-foreground">{article.primaryCategory?.name ?? "بدون دسته‌بندی"}</p>
        <h1 className="mt-2 text-4xl font-black">{article.title}</h1>
        {article.subtitle && <p className="mt-3 text-xl text-muted-foreground">{article.subtitle}</p>}
        {article.summary && <p className="my-6 rounded-lg bg-muted p-4 font-medium">{article.summary}</p>}
        <ArticleBody value={article.bodyJson} />
      </article>
    </main>
  );
}
