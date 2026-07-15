/* eslint-disable @next/next/no-img-element -- remote editorial media uses deployment-configured storage domains */
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { cache } from "react";
import { notFound } from "next/navigation";
import { ArticleBody, safePublicUrl } from "@/components/content/article-body";
import { ArticleList } from "@/components/public/article-card";
import { Breadcrumb } from "@/components/public/page-parts";
import { ViewTracker } from "@/components/public/view-tracker";
import { formatJalali } from "@/lib/dates";
import { ApiError } from "@/lib/api/errors";
import { siteConfig } from "@/lib/site-config";
import { publicSlugSchema } from "@/lib/validations/public";
import { publicContentService } from "@/server/services/public-content.service";

const articleBySlug = cache(async (slug: string) => {
  try {
    return await publicContentService.getArticleBySlug(slug);
  } catch (error) {
    if (error instanceof ApiError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
});

function normalizeSlug(value: string) {
  try {
    return decodeURIComponent(value).normalize("NFC");
  } catch {
    return value.normalize("NFC");
  }
}

export async function generateMetadata({ params }: PageProps<"/news/[slug]">): Promise<Metadata> {
  const parsed = publicSlugSchema.safeParse(normalizeSlug((await params).slug));
  if (!parsed.success) return {};
  const article = await articleBySlug(parsed.data);
  return {
    title: article.title,
    description: article.summary || article.subtitle || undefined,
    alternates: { canonical: article.canonicalUrl || `/news/${article.slug}` },
    robots: article.noindex ? { index: false, follow: false } : undefined,
  };
}

export default async function ArticlePage({ params }: PageProps<"/news/[slug]">) {
  const parsed = publicSlugSchema.safeParse(normalizeSlug((await params).slug));
  if (!parsed.success) notFound();
  const article = await articleBySlug(parsed.data);
  if (!article.publishedAt) notFound();
  const [related, navigation] = await Promise.all([
    publicContentService.getRelated(article.slug, 6),
    publicContentService.getArticleNavigation(article.id, article.publishedAt),
  ]);
  const authorName = article.author.profile?.displayName || article.author.name;
  const articleUrl = `${siteConfig.url}/news/${article.slug}`;
  return (
    <div className="public-container article-page">
      <ViewTracker articleId={article.id} />
      <Breadcrumb items={[...(article.primaryCategory ? [{ label: article.primaryCategory.name, href: `/category/${article.primaryCategory.slug}` }] : []), { label: article.title }]} />
      <article>
        <header className="article-header">
          {article.primaryCategory ? <Link className="article-kicker" href={`/category/${article.primaryCategory.slug}`}>{article.primaryCategory.name}</Link> : null}
          <h1>{article.title}</h1>
          {article.subtitle ? <p className="article-subtitle">{article.subtitle}</p> : null}
          {article.summary ? <p className="article-summary">{article.summary}</p> : null}
          <div className="article-meta article-meta-large">
            {article.author.profile?.slug ? <Link href={`/author/${article.author.profile.slug}`}>{authorName}</Link> : <span>{authorName}</span>}
            <time dateTime={article.publishedAt.toISOString()}>انتشار: {formatJalali(article.publishedAt)}</time>
            {article.updatedAt > article.publishedAt ? <time dateTime={article.updatedAt.toISOString()}>به‌روزرسانی: {formatJalali(article.updatedAt)}</time> : null}
            {article.readingTime ? <span>{article.readingTime} دقیقه مطالعه</span> : null}<span>{article.viewCount} بازدید</span>
          </div>
        </header>
        {article.featuredImage?.publicUrl ? <figure className="article-featured">{article.featuredImage.publicUrl.startsWith("/") ? <Image src={article.featuredImage.publicUrl} alt={article.featuredImage.alt || article.title} width={article.featuredImage.width || 1200} height={article.featuredImage.height || 675} priority sizes="(max-width: 900px) 100vw, 900px" /> : <img src={article.featuredImage.publicUrl} alt={article.featuredImage.alt || article.title} width={article.featuredImage.width || 1200} height={article.featuredImage.height || 675} referrerPolicy="no-referrer" />}{article.featuredImage.caption ? <figcaption>{article.featuredImage.caption}</figcaption> : null}</figure> : null}
        <div className="article-layout"><div>
          <ArticleBody value={article.bodyJson} />
          {(article.whyItMatters || article.whoIsAffected || article.whatToDo) ? <section className="article-context" aria-label="راهنمای خبر">{article.whyItMatters ? <div><h2>چرا مهم است؟</h2><p>{article.whyItMatters}</p></div> : null}{article.whoIsAffected ? <div><h2>چه کسانی تحت تأثیرند؟</h2><p>{article.whoIsAffected}</p></div> : null}{article.whatToDo ? <div><h2>چه باید کرد؟</h2><p>{article.whatToDo}</p></div> : null}</section> : null}
          {article.sources.length ? <section className="article-sources"><h2>منابع</h2><ol>{article.sources.map((item, index) => { const href = safePublicUrl(item.sourceUrl); return <li key={`${item.source.slug}-${index}`}>{href ? <a href={href} target="_blank" rel="noopener noreferrer nofollow">{item.sourceTitle || item.source.name}</a> : <span>{item.sourceTitle || item.source.name}</span>}</li>; })}</ol></section> : null}
          {article.corrections.length ? <section className="article-corrections"><h2>اصلاحیه‌ها</h2>{article.corrections.map((correction, index) => <article key={`${correction.title}-${index}`}><h3>{correction.title}</h3><p>{correction.description}</p>{correction.publishedAt ? <time dateTime={correction.publishedAt.toISOString()}>{formatJalali(correction.publishedAt)}</time> : null}</article>)}</section> : null}
          {article.tags.length ? <nav className="article-tags" aria-label="برچسب‌ها">{article.tags.map((item) => <Link key={item.tag.slug} href={`/tag/${item.tag.slug}`}>#{item.tag.name}</Link>)}</nav> : null}
          <nav className="article-share" aria-label="اشتراک‌گذاری"><span>اشتراک:</span><a href={`https://t.me/share/url?url=${encodeURIComponent(articleUrl)}&text=${encodeURIComponent(article.title)}`} target="_blank" rel="noopener noreferrer">تلگرام</a><a href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(articleUrl)}&text=${encodeURIComponent(article.title)}`} target="_blank" rel="noopener noreferrer">X</a><a href={`https://wa.me/?text=${encodeURIComponent(`${article.title} ${articleUrl}`)}`} target="_blank" rel="noopener noreferrer">واتس‌اپ</a></nav>
          <Link className="report-error" href={`/contact?article=${encodeURIComponent(article.slug)}`}>گزارش خطا در این مطلب</Link>
        </div></div>
      </article>
      <nav className="article-navigation" aria-label="مطالب قبلی و بعدی">{navigation.previous ? <Link href={`/news/${navigation.previous.slug}`}><small>مطلب قبلی</small>{navigation.previous.title}</Link> : <span />}{navigation.next ? <Link href={`/news/${navigation.next.slug}`}><small>مطلب بعدی</small>{navigation.next.title}</Link> : <span />}</nav>
      <section className="home-section"><div className="section-heading"><h2>مطالب مرتبط</h2></div><ArticleList articles={related} /></section>
    </div>
  );
}
