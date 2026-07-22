import "server-only";
import { prisma } from "@/lib/db";
import type { ScoringWeights } from "./types";

/**
 * Newsroom runtime settings — all real kill switches. Backed by the SiteSetting
 * key/value store under the "newsroom" key. Every toggle is honoured by the
 * pipeline (see pipeline.service). Defaults are conservative: collection and AI
 * are OFF until an admin explicitly enables them.
 */

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  relevanceToIraniansInTurkey: 25,
  legalImpact: 15,
  financialImpact: 10,
  urgency: 10,
  geographicRelevance: 10,
  sourceAuthority: 10,
  multiSourceConfirmation: 8,
  novelty: 5,
  publicSafety: 3,
  actionability: 2,
  viralityPotential: 1,
  longTermImportance: 1,
};

export interface NewsroomSettings {
  isEnabled: boolean;
  aiEnabled: boolean;
  collectionEnabled: boolean;
  draftGenerationEnabled: boolean;
  maxSourcesPerRun: number;
  maxItemsPerSource: number;
  maxDraftsPerRun: number;
  minScoreForAI: number;
  minScoreForDraft: number;
  dailyAiBudget: number;
  defaultLanguage: string;
  timezone: string;
  scoringWeights: ScoringWeights;
  fetchTimeout: number;
  retryCount: number;
  retentionDays: number;
}

export const DEFAULT_NEWSROOM_SETTINGS: NewsroomSettings = {
  isEnabled: false,
  aiEnabled: false,
  collectionEnabled: false,
  draftGenerationEnabled: false,
  maxSourcesPerRun: 20,
  maxItemsPerSource: 25,
  maxDraftsPerRun: 10,
  minScoreForAI: 60,
  minScoreForDraft: 60,
  dailyAiBudget: 2.0,
  defaultLanguage: "fa",
  timezone: "Europe/Istanbul",
  scoringWeights: DEFAULT_SCORING_WEIGHTS,
  fetchTimeout: 12_000,
  retryCount: 2,
  retentionDays: 30,
};

const SETTINGS_KEY = "newsroom";

function num(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

/** Merge stored (partial, untrusted) JSON over defaults with bounds-checking. */
export function coerceSettings(raw: unknown): NewsroomSettings {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_NEWSROOM_SETTINGS;
  return {
    isEnabled: bool(o.isEnabled, d.isEnabled),
    aiEnabled: bool(o.aiEnabled, d.aiEnabled),
    collectionEnabled: bool(o.collectionEnabled, d.collectionEnabled),
    draftGenerationEnabled: bool(o.draftGenerationEnabled, d.draftGenerationEnabled),
    maxSourcesPerRun: num(o.maxSourcesPerRun, d.maxSourcesPerRun, 1, 200),
    maxItemsPerSource: num(o.maxItemsPerSource, d.maxItemsPerSource, 1, 200),
    maxDraftsPerRun: num(o.maxDraftsPerRun, d.maxDraftsPerRun, 0, 100),
    minScoreForAI: num(o.minScoreForAI, d.minScoreForAI, 0, 100),
    minScoreForDraft: num(o.minScoreForDraft, d.minScoreForDraft, 0, 100),
    dailyAiBudget: num(o.dailyAiBudget, d.dailyAiBudget, 0, 1000),
    defaultLanguage: typeof o.defaultLanguage === "string" ? o.defaultLanguage : d.defaultLanguage,
    timezone: typeof o.timezone === "string" ? o.timezone : d.timezone,
    scoringWeights: coerceWeights(o.scoringWeights),
    fetchTimeout: num(o.fetchTimeout, d.fetchTimeout, 2000, 60_000),
    retryCount: num(o.retryCount, d.retryCount, 0, 5),
    retentionDays: num(o.retentionDays, d.retentionDays, 1, 3650),
  };
}

export function coerceWeights(raw: unknown): ScoringWeights {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_SCORING_WEIGHTS;
  const out = {} as ScoringWeights;
  for (const key of Object.keys(d) as (keyof ScoringWeights)[]) {
    out[key] = num(o[key], d[key], 0, 100);
  }
  return out;
}

export const newsroomSettingsService = {
  async get(): Promise<NewsroomSettings> {
    const row = await prisma.siteSetting.findUnique({ where: { key: SETTINGS_KEY } });
    return coerceSettings(row?.value);
  },

  /** Persist a full, validated settings object (upsert). */
  async save(next: NewsroomSettings): Promise<NewsroomSettings> {
    const validated = coerceSettings(next);
    await prisma.siteSetting.upsert({
      where: { key: SETTINGS_KEY },
      create: { key: SETTINGS_KEY, value: validated as unknown as object },
      update: { value: validated as unknown as object },
    });
    return validated;
  },
};
