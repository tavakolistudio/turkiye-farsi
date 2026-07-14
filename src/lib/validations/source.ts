import { z } from "zod";
import { SOURCE_TYPES, CREDIBILITY_LEVELS } from "@/lib/content-enums";
import { emptyToUndefined, optionalSlug, optionalUrl, optionalCuid } from "./common";

export const createSourceSchema = z.object({
  name: z.string().trim().min(2, "نام منبع باید حداقل ۲ کاراکتر باشد.").max(160),
  slug: optionalSlug,
  websiteUrl: optionalUrl,
  logoId: optionalCuid,
  country: emptyToUndefined(z.string().trim().max(80)),
  language: emptyToUndefined(z.string().trim().max(40)),
  sourceType: z.enum(SOURCE_TYPES).default("OTHER"),
  credibilityLevel: z.enum(CREDIBILITY_LEVELS).default("MEDIUM"),
  isOfficial: z.coerce.boolean().default(false),
  isActive: z.coerce.boolean().default(true),
  description: emptyToUndefined(z.string().trim().max(1000)),
});
export type CreateSourceInput = z.infer<typeof createSourceSchema>;

export const updateSourceSchema = createSourceSchema.partial();
export type UpdateSourceInput = z.infer<typeof updateSourceSchema>;

/** Attach a source to an article. */
export const attachSourceSchema = z.object({
  sourceId: z.string().min(1),
  sourceUrl: optionalUrl,
  sourceTitle: emptyToUndefined(z.string().trim().max(300)),
  accessedAt: emptyToUndefined(z.coerce.date()),
  isPrimary: z.coerce.boolean().default(false),
  note: emptyToUndefined(z.string().trim().max(500)),
});
export type AttachSourceInput = z.infer<typeof attachSourceSchema>;
