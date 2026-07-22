import { z } from "zod";
import { CollectionMethod } from "@prisma/client";

/** Zod schemas for newsroom admin forms/APIs. */

const weight = z.coerce.number().min(0).max(100);

export const scoringWeightsSchema = z.object({
  relevanceToIraniansInTurkey: weight,
  legalImpact: weight,
  financialImpact: weight,
  urgency: weight,
  geographicRelevance: weight,
  sourceAuthority: weight,
  multiSourceConfirmation: weight,
  novelty: weight,
  publicSafety: weight,
  actionability: weight,
  viralityPotential: weight,
  longTermImportance: weight,
});

export const newsroomSettingsSchema = z.object({
  isEnabled: z.coerce.boolean(),
  collectionEnabled: z.coerce.boolean(),
  aiEnabled: z.coerce.boolean(),
  draftGenerationEnabled: z.coerce.boolean(),
  maxSourcesPerRun: z.coerce.number().int().min(1).max(200),
  maxItemsPerSource: z.coerce.number().int().min(1).max(200),
  maxDraftsPerRun: z.coerce.number().int().min(0).max(100),
  minScoreForAI: z.coerce.number().int().min(0).max(100),
  minScoreForDraft: z.coerce.number().int().min(0).max(100),
  dailyAiBudget: z.coerce.number().min(0).max(1000),
  fetchTimeout: z.coerce.number().int().min(2000).max(60000),
  retryCount: z.coerce.number().int().min(0).max(5),
  retentionDays: z.coerce.number().int().min(1).max(3650),
  scoringWeights: scoringWeightsSchema,
});
export type NewsroomSettingsInput = z.infer<typeof newsroomSettingsSchema>;

/** Collection methods selectable in the UI (WEB_PAGE_ALLOWED excluded on purpose). */
export const COLLECTION_METHODS = ["RSS", "ATOM", "JSON_FEED", "OFFICIAL_API", "MANUAL"] as const;

export const newsroomSourceCollectionSchema = z.object({
  feedUrl: z
    .string()
    .trim()
    .url("نشانی فید معتبر نیست.")
    .max(2000)
    .refine((u) => /^https?:\/\//i.test(u), "فقط http/https مجاز است.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  collectionMethod: z.enum(COLLECTION_METHODS).default("MANUAL"),
  trustLevel: z.coerce.number().int().min(0).max(100).default(50),
  priority: z.coerce.number().int().min(0).max(1000).default(0),
  isEnabled: z.coerce.boolean().default(false),
  fetchIntervalMinutes: z.coerce.number().int().min(15).max(20160).default(1440),
  maxExcerptLength: z.coerce.number().int().min(80).max(1000).default(400),
  allowFullTextFetch: z.coerce.boolean().default(false),
});
export type NewsroomSourceCollectionInput = z.infer<typeof newsroomSourceCollectionSchema>;

export const testFeedSchema = z.object({
  feedUrl: z.string().trim().url().max(2000),
});

export { CollectionMethod };
