import { z } from "zod";

/**
 * Zod schemas for every structured AI output. The AI is UNTRUSTED: its JSON is
 * always parsed through these schemas before use, so a malformed or hostile
 * response can never reach the database. Unknown keys are stripped.
 */

export const aiClassificationSchema = z
  .object({
    primaryCategorySlug: z.string().nullable().default(null),
    secondaryCategorySlugs: z.array(z.string()).max(4).default([]),
    suggestedTagSlugs: z.array(z.string()).max(8).default([]),
    affectedAudience: z.string().max(200).nullable().default(null),
    geographicScope: z.string().max(120).nullable().default(null),
    sensitivityLevel: z.enum(["LOW", "MEDIUM", "HIGH"]).default("LOW"),
  })
  .strip();
export type AiClassification = z.infer<typeof aiClassificationSchema>;

export const aiImportanceSchema = z
  .object({
    score: z.number().min(0).max(100),
    reasons: z.array(z.string().max(200)).max(8).default([]),
  })
  .strip();
export type AiImportance = z.infer<typeof aiImportanceSchema>;

export const aiTrustSchema = z
  .object({
    verificationStatus: z.enum([
      "UNVERIFIED",
      "SINGLE_SOURCE",
      "MULTI_SOURCE",
      "OFFICIAL_CONFIRMED",
      "CONFLICTING",
      "REJECTED",
    ]),
    requiresHumanFactCheck: z.boolean(),
    reasonCodes: z.array(z.string().max(200)).max(8).default([]),
  })
  .strip();
export type AiTrust = z.infer<typeof aiTrustSchema>;

export const aiDraftSchema = z
  .object({
    title: z.string().min(3).max(200),
    subtitle: z.string().max(300).nullable().default(null),
    summary: z.string().max(1000),
    body: z.string().max(8000),
    whyItMatters: z.string().max(1000).nullable().default(null),
    whoIsAffected: z.string().max(1000).nullable().default(null),
    whatToDo: z.string().max(1000).nullable().default(null),
    isBreakingSuggestion: z.boolean().default(false),
  })
  .strip();
export type AiDraft = z.infer<typeof aiDraftSchema>;

export const aiSeoSchema = z
  .object({
    metaTitle: z.string().max(200),
    metaDescription: z.string().max(320),
  })
  .strip();
export type AiSeo = z.infer<typeof aiSeoSchema>;

export const aiSocialSchema = z
  .object({
    instagramCaption: z.string().max(2200).nullable().default(null),
    telegramCaption: z.string().max(2000).nullable().default(null),
    reelTitle: z.string().max(120).nullable().default(null),
    carouselTitle: z.string().max(120).nullable().default(null),
    pushTitle: z.string().max(120).nullable().default(null),
    pushBody: z.string().max(240).nullable().default(null),
  })
  .strip();
export type AiSocial = z.infer<typeof aiSocialSchema>;

/** Token/cost accounting attached to every AI call. */
export interface AiUsage {
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
}
