import { z } from "zod";

/** Shared list-query parsing: pagination, sorting, search. */
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  search: z.string().trim().max(200).optional(),
  sort: z.string().max(50).optional(),
  order: z.enum(["asc", "desc"]).default("desc"),
  includeDeleted: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .transform((v) => v === true || v === "true")
    .default(false),
});

export type ListQuery = z.infer<typeof listQuerySchema>;

/** Parse URLSearchParams into a ListQuery (plus any extra fields). */
export function parseListQuery(searchParams: URLSearchParams): ListQuery {
  return listQuerySchema.parse(Object.fromEntries(searchParams.entries()));
}

export function paginationArgs(q: { page: number; pageSize: number }) {
  return { skip: (q.page - 1) * q.pageSize, take: q.pageSize };
}

export function paginationMeta(q: { page: number; pageSize: number }, total: number) {
  return {
    page: q.page,
    pageSize: q.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
  };
}

/**
 * Build a Prisma orderBy from a whitelist of sortable fields, falling back to a
 * default. Prevents arbitrary/unsafe sort columns.
 */
export function buildOrderBy<T extends string>(
  sort: string | undefined,
  order: "asc" | "desc",
  allowed: readonly T[],
  fallback: T,
): Record<string, "asc" | "desc"> {
  const field = sort && (allowed as readonly string[]).includes(sort) ? sort : fallback;
  return { [field]: order };
}
