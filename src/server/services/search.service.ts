import "server-only";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { publicCardSelect, type PublicCard } from "@/server/data/article.repo";

/**
 * Full-text-ish public search over published articles. Matches title,
 * subtitle, summary, body text, category name, tag name and author name.
 * Two real sort modes: relevance (weighted field score) and newest. Results
 * are always constrained to genuinely-published content.
 */

export const searchQuerySchema = z.object({
  q: z.string().trim().min(2, "عبارت جستجو باید حداقل ۲ نویسه باشد.").max(100),
  page: z.coerce.number().int().min(1).max(500).default(1),
  sort: z.enum(["relevance", "newest"]).default("relevance"),
  category: z
    .string()
    .trim()
    .max(200)
    .regex(/^[a-z0-9؀-ۿ-]+$/u)
    .optional(),
  author: z
    .string()
    .trim()
    .max(200)
    .regex(/^[a-z0-9\u0600-\u06ff-]+$/u)
    .optional(),
  from: z.string().trim().max(20).optional(),
  to: z.string().trim().max(20).optional(),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;

export const SEARCH_PAGE_SIZE = 12;

/** Escape LIKE/ILIKE wildcards in user input so `%` and `_` are literal. */
function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
}

function parseDate(value: string | undefined, endOfDay = false): Date | null {
  if (!value) return null;
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z` : value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const searchService = {
  /**
   * Run a search. Always records a SearchLog entry (including zero-result
   * queries) so the newsroom can see demand and gaps.
   */
  async search(input: SearchQuery) {
    const query = input.q;
    const like = likePattern(query);
    const skip = (input.page - 1) * SEARCH_PAGE_SIZE;

    // Optional filters composed as SQL fragments (parameterised — no injection).
    const filters: Prisma.Sql[] = [];
    if (input.category) {
      filters.push(Prisma.sql`
        AND EXISTS (
          SELECT 1 FROM categories c
          WHERE c.slug = ${input.category} AND c."deletedAt" IS NULL
            AND (
              a."primaryCategoryId" = c.id
              OR EXISTS (
                SELECT 1 FROM article_categories ac
                WHERE ac."articleId" = a.id AND ac."categoryId" = c.id
              )
            )
        )`);
    }
    if (input.author) {
      filters.push(Prisma.sql`
        AND EXISTS (
          SELECT 1 FROM profiles p
          WHERE p."userId" = a."authorId" AND p.slug = ${input.author} AND p."isPublic" = true
        )`);
    }
    const from = parseDate(input.from);
    if (from) filters.push(Prisma.sql`AND a."publishedAt" >= ${from}`);
    const to = parseDate(input.to, true);
    if (to) filters.push(Prisma.sql`AND a."publishedAt" <= ${to}`);
    const filterSql = filters.length ? Prisma.join(filters, " ") : Prisma.empty;

    const documentSql = Prisma.sql`to_tsvector(
      'simple',
      coalesce(a.title, '') || ' ' || coalesce(a.subtitle, '') || ' ' ||
      coalesce(a.summary, '') || ' ' || coalesce(a."bodyJson"::text, '')
    )`;
    const querySql = Prisma.sql`websearch_to_tsquery('simple', ${query})`;

    const matchSql = Prisma.sql`(
      ${documentSql} @@ ${querySql}
      OR a.title ILIKE ${like}
      OR a.subtitle ILIKE ${like}
      OR a.summary ILIKE ${like}
      OR a."bodyJson"::text ILIKE ${like}
      OR EXISTS (
        SELECT 1 FROM article_categories ac JOIN categories c ON c.id = ac."categoryId"
        WHERE ac."articleId" = a.id AND c.name ILIKE ${like}
      )
      OR EXISTS (
        SELECT 1 FROM article_tags t JOIN tags tg ON tg.id = t."tagId"
        WHERE t."articleId" = a.id AND tg.name ILIKE ${like}
      )
      OR EXISTS (
        SELECT 1 FROM users u LEFT JOIN profiles p ON p."userId" = u.id
        WHERE u.id = a."authorId" AND (u.name ILIKE ${like} OR p."displayName" ILIKE ${like})
      )
    )`;

    const baseWhere = Prisma.sql`
      FROM articles a
      WHERE a.status = 'PUBLISHED' AND a."deletedAt" IS NULL
        AND a."publishedAt" IS NOT NULL AND a."publishedAt" <= now()
        AND ${matchSql}
        ${filterSql}`;

    const orderSql =
      input.sort === "newest"
        ? Prisma.sql`ORDER BY a."publishedAt" DESC`
        : Prisma.sql`ORDER BY score DESC, a."publishedAt" DESC`;

    const [ranked, countRows] = await Promise.all([
      prisma.$queryRaw<{ id: string }[]>`
        SELECT a.id,
          ( ts_rank_cd(${documentSql}, ${querySql}, 32) * 10
          + (CASE WHEN a.title ILIKE ${like} THEN 5 ELSE 0 END)
          + (CASE WHEN a.subtitle ILIKE ${like} THEN 3 ELSE 0 END)
          + (CASE WHEN a.summary ILIKE ${like} THEN 3 ELSE 0 END)
          + (CASE WHEN a."bodyJson"::text ILIKE ${like} THEN 1 ELSE 0 END) ) AS score
        ${baseWhere}
        ${orderSql}
        LIMIT ${SEARCH_PAGE_SIZE} OFFSET ${skip}`,
      prisma.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*)::bigint AS count ${baseWhere}`,
    ]);

    const total = Number(countRows[0]?.count ?? 0);

    // Record demand (including zero-result queries) — never let a logging
    // failure break the search itself.
    try {
      await prisma.searchLog.create({ data: { query, resultCount: total } });
    } catch {
      /* logging is best-effort */
    }

    let rows: PublicCard[] = [];
    if (ranked.length) {
      const ids = ranked.map((r) => r.id);
      const found = await prisma.article.findMany({
        where: { id: { in: ids } },
        select: publicCardSelect,
      });
      const rank = new Map(ids.map((id, i) => [id, i]));
      rows = found.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
    }

    return {
      rows,
      total,
      page: input.page,
      pageSize: SEARCH_PAGE_SIZE,
      totalPages: Math.max(1, Math.ceil(total / SEARCH_PAGE_SIZE)),
    };
  },
};
