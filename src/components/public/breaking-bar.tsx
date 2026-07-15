import Link from "next/link";
import { publicSiteService } from "@/server/services/public-site.service";
import { routes } from "@/lib/public-links";

/**
 * Breaking-news ticker. Renders admin-managed BreakingNews items; if an item
 * points at an article it links there, otherwise to an external URL. Renders
 * nothing when there are no active items (no fabricated ticker).
 */
export async function BreakingBar() {
  const items = await publicSiteService.breakingTicker();
  if (!items.length) return null;

  return (
    <aside aria-label="اخبار فوری" className="border-b border-border bg-breaking text-breaking-foreground">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-2">
        <span className="shrink-0 rounded bg-breaking-foreground/15 px-2 py-0.5 text-xs font-extrabold">
          فوری
        </span>
        <ul className="flex items-center gap-6 overflow-x-auto whitespace-nowrap text-sm font-medium">
          {items.map((item) => {
            // Link to the linked article only when it is genuinely public.
            if (item.articleSlug) {
              return (
                <li key={item.id}>
                  <Link href={routes.article(item.articleSlug)} className="hover:underline">{item.title}</Link>
                </li>
              );
            }
            if (item.url) {
              return (
                <li key={item.id}>
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    {item.title}
                  </a>
                </li>
              );
            }
            return <li key={item.id}>{item.title}</li>;
          })}
        </ul>
      </div>
    </aside>
  );
}
