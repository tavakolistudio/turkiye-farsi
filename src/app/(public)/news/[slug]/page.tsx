import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { publicSiteService } from "@/server/services/public-site.service";
import { ApiError } from "@/lib/api/errors";
import { ArticleBody } from "@/components/content/article-body";
import { Breadcrumb } from "@/components/public/ui";
import { Byline, CategoryChip } from "@/components/public/article-meta";
import { PostImage } from "@/components/public/post-image";
import { ShareButtons } from "@/components/public/share-buttons";
import {
  ArticleCorrection,
  ArticleSources,
  ImpactForIranians,
  RelatedArticles,
} from "@/components/public/editorial-sections";
import { ViewTracker } from "@/components/public/view-tracker";
import { JsonLd } from "@/components/seo/json-ld";
import { routes } from "@/lib/public-links";
import { siteConfig } from "@/lib/site-config";
import { formatJalali, toIso, toPersianDigits } from "@/lib/dates";
import { buildMetadata } from "@/lib/seo/metadata";
import { absoluteUrl, canonicalUrl, ogImageUrl } from "@/lib/seo/urls";
import { articleSchema, breadcrumbSchema, graph, type PersonInput } from "@/lib/seo/jsonld";
import { siteSettingsService } from "@/server/services/site-settings.service";
import { redirectOrNotFound } from "@/server/seo/redirect-or-404";

type Props = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  try {
    return await publicSiteService.articleDetail(decodeURIComponent(slug));
  } catch (err) {
    if (err instanceof ApiError && err.code === "NOT_FOUND") return null;
    throw err;
  }
}

/** Author as a schema.org Person, linking to the public author page when public. */
function authorPerson(author: {
  name: string;
  profile?: { slug: string; displayName: string | null; avatarUrl: string | null } | null;
}): PersonInput {
  const p = author.profile;
  return {
    name: p?.displayName || author.name,
    url: p?.slug ? absoluteUrl(routes.author(p.slug)) : undefined,
    image: p?.avatarUrl ?? undefined,
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [data, publisher] = await Promise.all([load(slug), siteSettingsService.publisher()]);
  if (!data) return { title: "مطلب یافت نشد", robots: { index: false, follow: false } };
  const a = data.article;
  const metaImage = a.ogImage ?? a.featuredImage;
  return buildMetadata({
    title: a.title,
    description: a.summary ?? a.subtitle ?? undefined,
    // A stored canonicalUrl (syndication) wins; otherwise the article's own URL.
    path: a.canonicalUrl ?? routes.article(a.slug),
    image: metaImage?.publicUrl,
    imageWidth: metaImage?.width,
    imageHeight: metaImage?.height,
    fallbackImage: publisher.logo,
    noindex: a.noindex,
    ogType: "article",
    publishedTime: a.publishedAt ? toIso(new Date(a.publishedAt)) : undefined,
    modifiedTime: a.updatedAt ? toIso(new Date(a.updatedAt)) : undefined,
    authors: [a.author.profile?.displayName || a.author.name],
    section: a.primaryCategory?.name,
    tags: a.tags.map((t) => t.tag.name),
  });
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const data = (await load(slug)) ?? (await redirectOrNotFound(`/news/${decodeURIComponent(slug)}`));

  const { article: a, related, previous, next } = data;
  const published = a.publishedAt ? new Date(a.publishedAt) : null;
  const updated = a.updatedAt ? new Date(a.updatedAt) : null;
  const showUpdated = published && updated && updated.getTime() - published.getTime() > 60_000;

  // Structured data — only reachable for genuinely-published articles (load()
  // returns null for anything else, which 404s above).
  const publisher = await siteSettingsService.publisher();
  const selfUrl = canonicalUrl(a.canonicalUrl ?? routes.article(a.slug));
  const articleGraph = graph(
    articleSchema(
      {
        type: a.contentType === "NEWS" || a.contentType === "SHORT_NEWS" ? "NewsArticle" : "Article",
        headline: a.title,
        description: a.summary ?? a.subtitle ?? undefined,
        url: selfUrl,
        images: a.ogImage?.publicUrl
          ? [ogImageUrl(a.ogImage.publicUrl)]
          : a.featuredImage?.publicUrl
            ? [ogImageUrl(a.featuredImage.publicUrl)]
            : publisher.logo
              ? [ogImageUrl(publisher.logo)]
              : [],
        datePublished: toIso(published!),
        dateModified: updated ? toIso(updated) : undefined,
        author: authorPerson(a.author),
        section: a.primaryCategory?.name,
        keywords: a.tags.map((t) => t.tag.name),
      },
      publisher,
    ),
    breadcrumbSchema([
      { name: "خانه", url: absoluteUrl("/")! },
      ...(a.primaryCategory
        ? [{ name: a.primaryCategory.name, url: absoluteUrl(routes.category(a.primaryCategory.slug))! }]
        : []),
      { name: a.title, url: selfUrl },
    ]),
  );

  return (
    <>
      <JsonLd data={articleGraph} />
      <ViewTracker slug={a.slug} />
      <article className="article-page mx-auto">
        <Breadcrumb
          items={[
            ...(a.primaryCategory
              ? [{ label: a.primaryCategory.name, href: routes.category(a.primaryCategory.slug) }]
              : []),
            { label: a.title },
          ]}
        />

        <header className="article-header">
          <CategoryChip category={a.primaryCategory} />
          <h1>{a.title}</h1>
          {a.subtitle && <p className="article-subtitle">{a.subtitle}</p>}

          <div className="article-meta article-meta-large">
            <Byline author={a.author} className="text-foreground" />
            {published && <time dateTime={toIso(published)}>{formatJalali(published)}</time>}
            {showUpdated && updated && (
              <span>به‌روزرسانی: <time dateTime={toIso(updated)}>{formatJalali(updated)}</time></span>
            )}
            {a.readingTime ? <span>{toPersianDigits(a.readingTime)} دقیقه مطالعه</span> : null}
            <span>{toPersianDigits(a.viewCount)} بازدید</span>
          </div>
        </header>

        {a.changeWarning && (
          <div className="article-change-warning">
            ⚠️ این مطلب درباره موضوعی است که ممکن است شرایط آن تغییر کند؛ پیش از اقدام، اطلاعات را از منابع رسمی نیز بررسی کنید.
          </div>
        )}

        {a.featuredImage?.publicUrl && (
          <figure className="article-featured">
            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-md">
              <PostImage src={a.featuredImage.publicUrl} alt={a.featuredImage.alt ?? a.title} sizes="(max-width: 768px) 100vw, 768px" priority />
            </div>
            {a.featuredImage.caption && (
              <figcaption className="mt-2 text-center text-sm text-muted-foreground">{a.featuredImage.caption}</figcaption>
            )}
          </figure>
        )}

        {a.summary && (
          <p className="article-summary">
            {a.summary}
          </p>
        )}

        <ArticleBody value={a.bodyJson} />

        <ImpactForIranians story={{ whyItMatters: a.whyItMatters, whoIsAffected: a.whoIsAffected, whatToDo: a.whatToDo }} />
        <ArticleSources sources={a.sources} />
        <ArticleCorrection corrections={a.corrections} />

        {a.tags.length > 0 && (
          <div className="article-tags">
            {a.tags.map((t) => (
              <Link
                key={t.tag.slug}
                href={routes.tag(t.tag.slug)}
                className="rounded-full bg-muted px-3 py-1 text-sm hover:bg-accent"
              >
                #{t.tag.name}
              </Link>
            ))}
          </div>
        )}

        <div className="article-share-row">
          <ShareButtons title={a.title} url={`${siteConfig.url}${routes.article(a.slug)}`} />
          <Link href={`${routes.page("contact")}`} className="text-sm text-muted-foreground underline hover:text-primary">
            گزارش خطا در این مطلب
          </Link>
        </div>

        {(previous || next) && (
          <nav aria-label="پیمایش مطالب" className="article-navigation">
            {previous ? (
              <Link href={routes.article(previous.slug)} className="flex items-center gap-2 rounded-lg border border-border p-4 hover:bg-accent">
                <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-xs text-muted-foreground">مطلب قبلی</span>
                  <span className="line-clamp-1 font-medium">{previous.title}</span>
                </span>
              </Link>
            ) : <span />}
            {next ? (
              <Link href={routes.article(next.slug)} className="flex items-center justify-end gap-2 rounded-lg border border-border p-4 text-left hover:bg-accent">
                <span className="min-w-0">
                  <span className="block text-xs text-muted-foreground">مطلب بعدی</span>
                  <span className="line-clamp-1 font-medium">{next.title}</span>
                </span>
                <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
              </Link>
            ) : <span />}
          </nav>
        )}
      </article>

      <RelatedArticles articles={related} />
    </>
  );
}
