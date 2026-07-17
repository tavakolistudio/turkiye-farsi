import type { Metadata } from "next";
import { publicSiteService } from "@/server/services/public-site.service";
import { ApiError } from "@/lib/api/errors";
import { ArticleCard } from "@/components/public/article-card";
import { Breadcrumb, EmptyState, Pagination } from "@/components/public/ui";
import { JsonLd } from "@/components/seo/json-ld";
import { routes } from "@/lib/public-links";
import { buildMetadata } from "@/lib/seo/metadata";
import { absoluteUrl } from "@/lib/seo/urls";
import { breadcrumbSchema, graph, personSchema } from "@/lib/seo/jsonld";
import { redirectOrNotFound } from "@/server/seo/redirect-or-404";
import { siteSettingsService } from "@/server/services/site-settings.service";
import { AuthorCard } from "@/components/public/author-card";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
};

const PAGE_SIZE = 12;

function pageNum(v: string | undefined) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

async function load(slug: string, page: number) {
  try {
    return await publicSiteService.author(decodeURIComponent(slug), (page - 1) * PAGE_SIZE, PAGE_SIZE);
  } catch (err) {
    if (err instanceof ApiError && err.code === "NOT_FOUND") return null;
    throw err;
  }
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ slug }, sp, publisher] = await Promise.all([params, searchParams, siteSettingsService.publisher()]);
  const page = pageNum(sp.page);
  const data = await load(slug, page);
  if (!data) return { title: "نویسنده یافت نشد", robots: { index: false, follow: false } };
  const name = data.profile.displayName ?? "نویسنده";
  return buildMetadata({
    title: name,
    description: data.profile.bio ?? `مطالب منتشرشده توسط ${name} در ترکیه فارسی.`,
    path: routes.author(data.profile.slug),
    canonicalParams: { page: page > 1 ? page : undefined },
    image: data.profile.avatarUrl,
    fallbackImage: publisher.logo,
  });
}

/** Public social profile URLs (absolute only) for Person.sameAs. */
function authorSameAs(p: { website: string | null; twitter: string | null; instagram: string | null; telegram: string | null; linkedin: string | null }): string[] {
  return [p.website, p.twitter, p.instagram, p.telegram, p.linkedin]
    .map((v) => v?.trim())
    .filter((v): v is string => !!v && /^https?:\/\//i.test(v));
}

export default async function AuthorPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const page = pageNum((await searchParams).page);
  const data = (await load(slug, page)) ?? (await redirectOrNotFound(`/author/${decodeURIComponent(slug)}`));

  const { profile, rows, total } = data;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const name = profile.displayName ?? "نویسنده";
  const authorUrl = absoluteUrl(routes.author(profile.slug))!;
  const authorGraph = graph(
    personSchema({
      name,
      url: authorUrl,
      image: profile.avatarUrl,
      description: profile.bio,
      jobTitle: profile.expertise,
      sameAs: authorSameAs(profile),
    }),
    breadcrumbSchema([
      { name: "خانه", url: absoluteUrl("/")! },
      { name, url: authorUrl },
    ]),
  );

  return (
    <div className="editorial-listing-page">
      <JsonLd data={authorGraph} />
      <Breadcrumb items={[{ label: name }]} />

      <AuthorCard profile={profile} fallbackName={name} />

      {rows.length ? (
        <>
          <div className="editorial-three-grid">
            {rows.map((a) => <ArticleCard key={a.id} article={a} />)}
          </div>
          <Pagination page={page} totalPages={totalPages} basePath={routes.author(profile.slug)} />
        </>
      ) : (
        <EmptyState title="هنوز مطلبی از این نویسنده منتشر نشده است" />
      )}
    </div>
  );
}
