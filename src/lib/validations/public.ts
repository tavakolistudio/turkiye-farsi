import { z } from "zod";

// Existing Persian slugs may contain ZWNJ and Persian punctuation (for example
// U+061F). Block path/query delimiters and control bytes instead of rejecting
// valid Unicode typography.
const slug = z.string().trim().min(1).max(180).regex(/^[^/\\?#\u0000-\u001F\u007F]+$/u);

function normalizeRouteSegment(value: unknown) {
  if (typeof value !== "string") return value;
  try {
    return decodeURIComponent(value).normalize("NFC");
  } catch {
    return value.normalize("NFC");
  }
}

export const publicSlugSchema = z.preprocess(normalizeRouteSegment, slug);

export const publicListSchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
});

export const newsListSchema = publicListSchema.extend({
  category: slug.optional(),
  contentType: z.enum(["SHORT_NEWS", "NEWS", "ARTICLE", "ANALYSIS", "GUIDE", "NOTICE", "VIDEO"]).optional(),
  sort: z.enum(["latest", "oldest", "most-viewed"]).default("latest"),
  q: z.string().trim().max(200).optional(),
});

export const searchSchema = publicListSchema.extend({
  q: z.string().trim().min(2).max(200),
  category: slug.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  sort: z.enum(["relevance", "latest"]).default("relevance"),
}).refine((value) => !value.from || !value.to || value.from <= value.to, {
  message: "بازه تاریخ معتبر نیست.",
  path: ["to"],
});

export const mostViewedSchema = publicListSchema.extend({
  range: z.enum(["today", "week", "month", "all"]).default("week"),
});

export function parseParams<T extends z.ZodTypeAny>(schema: T, params: URLSearchParams): z.infer<T> {
  return schema.parse(Object.fromEntries(params.entries()));
}
