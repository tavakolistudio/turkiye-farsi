import Link from "next/link";
import { publicSiteService } from "@/server/services/public-site.service";
import { routes } from "@/lib/public-links";
import { formatJalali, toIso } from "@/lib/dates";

/**
 * Breaking-news ticker. Renders admin-managed BreakingNews items; if an item
 * points at an article it links there, otherwise to an external URL. Renders
 * nothing when there are no active items (no fabricated ticker).
 */
export async function BreakingBar() {
  const items = await publicSiteService.breakingTicker();
  if (!items.length) return null;

  return (
    <aside aria-label="اخبار فوری" className="breaking-news-bar">
      <div className="editorial-shell breaking-news-inner">
        <strong>خبر فوری</strong>
        <ul>
          {items.map((item) => {
            const time = (
              <time dateTime={toIso(new Date(item.createdAt))}>{formatJalali(new Date(item.createdAt), "HH:mm")}</time>
            );
            // Link to the linked article only when it is genuinely public.
            if (item.articleSlug) {
              return (
                <li key={item.id}>
                  {time}<Link href={routes.article(item.articleSlug)}>{item.title}</Link>
                </li>
              );
            }
            if (item.url) {
              return (
                <li key={item.id}>
                  {time}<a href={item.url} target="_blank" rel="noopener noreferrer">
                    {item.title}
                  </a>
                </li>
              );
            }
            return <li key={item.id}>{time}<span>{item.title}</span></li>;
          })}
        </ul>
      </div>
    </aside>
  );
}
