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

const SOCIAL_LINKS: { key: keyof NonNullable<Awaited<ReturnType<typeof publicSiteService.author>>["profile"]>; label: string }[] = [
  { key: "website", label: "وب‌سایت" },
  { key: "twitter", label: "ایکس" },
  { key: "instagram", label: "اینستاگرام" },
  { key: "telegram", label: "تلگرام" },
  { key: "linkedin", label: "لینکدین" },
];

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
    <div>
      <JsonLd data={authorGraph} />
      <Breadcrumb items={[{ label: name }]} />

      <header className="mb-8 flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-start">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-2xl font-bold">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {profile.avatarUrl ? <img src={profile.avatarUrl} alt={name} className="h-full w-full object-cover" /> : name.slice(0, 1)}
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold">{name}</h1>
          {profile.expertise && <p className="mt-1 text-sm text-primary">{profile.expertise}</p>}
          {profile.bio && <p className="mt-2 max-w-2xl text-muted-foreground">{profile.bio}</p>}
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            {profile.publicEmail && (
              <a href={`mailto:${profile.publicEmail}`} className="text-primary hover:underline">ایمیل</a>
            )}
            {SOCIAL_LINKS.map(({ key, label }) => {
              const value = profile[key];
              return typeof value === "string" && value ? (
                <a key={key} href={value} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  {label}
                </a>
              ) : null;
            })}
          </div>
        </div>
      </header>

      {rows.length ? (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
