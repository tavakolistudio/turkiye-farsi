import Link from "next/link";
import { prisma } from "@/lib/db";
import { siteConfig } from "@/lib/site-config";
import { formatJalali } from "@/lib/dates";

// Phase 6 will add proper caching/revalidation; for now render on request so
// the homepage always reflects the database.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const articles = await prisma.article.findMany({
    where: { status: "PUBLISHED", deletedAt: null },
    orderBy: { publishedAt: "desc" },
    take: 10,
    include: {
      author: { select: { name: true } },
      categories: {
        where: { isPrimary: true },
        include: { category: { select: { name: true, slug: true } } },
      },
    },
  });

  return (
    <main id="main-content" className="mx-auto w-full max-w-5xl px-4 py-10">
      <header className="mb-10 border-b border-border pb-6">
        <p className="text-sm text-muted-foreground">{siteConfig.nameEn}</p>
        <h1 className="mt-1 text-4xl font-extrabold tracking-tight">
          {siteConfig.name}
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          {siteConfig.description}
        </p>
      </header>

      <section aria-labelledby="latest-heading">
        <h2 id="latest-heading" className="mb-5 text-xl font-bold">
          آخرین اخبار
        </h2>

        {articles.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
            هنوز خبری منتشر نشده است.
          </p>
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2">
            {articles.map((a) => {
              const category = a.categories[0]?.category;
              return (
                <li
                  key={a.id}
                  className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary"
                >
                  {category && (
                    <span className="text-xs font-medium text-primary">
                      {category.name}
                    </span>
                  )}
                  <h3 className="mt-1 text-lg font-bold leading-snug">
                    <Link href={`/news/${a.slug}`} className="hover:underline">
                      {a.title}
                    </Link>
                  </h3>
                  {a.summary && (
                    <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                      {a.summary}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{a.author.name}</span>
                    {a.publishedAt && (
                      <>
                        <span aria-hidden>•</span>
                        <time dateTime={a.publishedAt.toISOString()}>
                          {formatJalali(a.publishedAt)}
                        </time>
                      </>
                    )}
                    {a.readingTime && (
                      <>
                        <span aria-hidden>•</span>
                        <span>{a.readingTime} دقیقه مطالعه</span>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
