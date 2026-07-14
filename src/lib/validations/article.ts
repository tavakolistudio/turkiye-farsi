import { z } from "zod";
import {
  CONTENT_TYPES,
  FACT_CHECK_STATUSES,
  ARTICLE_SOURCE_STATUSES,
} from "@/lib/content-enums";
import {
  emptyToUndefined,
  optionalSlug,
  optionalUrl,
  optionalCuid,
  metaDescription,
} from "./common";

const optionalText = (max: number) => emptyToUndefined(z.string().trim().max(max));

/**
 * Article create schema. Only whitelisted fields are accepted (prevents mass
 * assignment of e.g. viewCount, publishedAt, timestamps).
 */
export const createArticleSchema = z.object({
  title: z.string().trim().min(3, "عنوان باید حداقل ۳ کاراکتر باشد.").max(300),
  slug: optionalSlug,
  subtitle: optionalText(300),
  summary: optionalText(500),
  bodyJson: z.any().optional(),

  contentType: z.enum(CONTENT_TYPES).default("NEWS"),
  // New articles always enter the central workflow as drafts.
  status: z.literal("DRAFT").default("DRAFT"),

  primaryCategoryId: optionalCuid,
  authorId: optionalCuid, // defaults to the acting user when omitted
  featuredImageId: optionalCuid,

  categoryIds: z.array(z.string().min(1)).max(10).optional(),
  tagIds: z.array(z.string().min(1)).max(30).optional(),

  priority: z.coerce.number().int().min(0).max(100).default(0),
  isBreaking: z.coerce.boolean().default(false),
  isEditorsPick: z.coerce.boolean().default(false),
  isHero: z.coerce.boolean().default(false),
  isFeatured: z.coerce.boolean().default(false),
  commentsEnabled: z.coerce.boolean().default(false),

  // Editorial
  whyItMatters: optionalText(2000),
  whoIsAffected: optionalText(2000),
  whatToDo: optionalText(2000),
  factCheckStatus: z.enum(FACT_CHECK_STATUSES).default("UNCHECKED"),
  changeWarning: z.coerce.boolean().default(false),
  sourceStatus: z.enum(ARTICLE_SOURCE_STATUSES).default("MISSING"),

  // SEO
  metaTitle: optionalText(300),
  metaDescription,
  canonicalUrl: optionalUrl,
  ogImageId: optionalCuid,
  noindex: z.coerce.boolean().default(false),

  // Social (future)
  instagramCaption: optionalText(2200),
  telegramCaption: optionalText(2000),
  reelTitle: optionalText(200),
  carouselTitle: optionalText(200),
  pushTitle: optionalText(120),
  pushBody: optionalText(300),
});

export type CreateArticleInput = z.infer<typeof createArticleSchema>;

/** Update schema: everything optional; slug can be omitted to keep the current. */
export const updateArticleSchema = createArticleSchema
  .omit({ status: true })
  .partial()
  .extend({ version: z.number().int().nonnegative() });
export type UpdateArticleInput = z.infer<typeof updateArticleSchema>;
