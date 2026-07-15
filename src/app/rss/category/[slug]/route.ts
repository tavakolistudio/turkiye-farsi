import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { renderRssFeed } from "@/lib/seo/rss-feed";
import { xmlResponse } from "@/lib/seo/xml";
import { siteConfig } from "@/lib/site-config";
import { routes } from "@/lib/public-links";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const raw = (await params).slug.replace(/\.xml$/i, "");
  const slug = decodeURIComponent(raw);
  const category = await prisma.category.findFirst({
    where: { slug, deletedAt: null, isActive: true },
    select: { name: true, slug: true },
  });
  if (!category) notFound();

  const xml = await renderRssFeed({
    titleSuffix: category.name,
    description: `اخبار دسته «${category.name}» — ${siteConfig.name}`,
    sectionPath: routes.category(category.slug),
    feedPath: `/rss/category/${category.slug}.xml`,
    categorySlug: category.slug,
  });
  return xmlResponse(xml, 900);
}
