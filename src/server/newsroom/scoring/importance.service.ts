import type { ImportanceComponents, ImportanceResult, ScoringWeights } from "../types";
import { comparableText } from "../normalize/persian";
import { DEFAULT_SCORING_WEIGHTS } from "../settings";

/**
 * Rule-based importance scoring for the "Iranians in Turkey" audience.
 *
 * Deterministic and EXPLAINABLE: each 0..1 component is derived from keyword
 * signals in the normalized text, then multiplied by an admin-configurable
 * weight. The default weights sum to 100, so the weighted total is already a
 * 0..100 score. Every non-trivial signal appends a short Persian reason code.
 *
 * This never invents a score from nothing — with no signal the item scores low.
 * The AI score (when enabled) is stored SEPARATELY; this rule score always
 * stands on its own so the pipeline survives AI failure.
 */

export interface ImportanceContext {
  normalizedText: string;
  /** 0..100 editorial trust of the source. */
  sourceTrustLevel: number;
  sourceIsOfficial: boolean;
  /** How many distinct sources are in this item's story cluster. */
  clusterSourceCount: number;
  publishedAt?: Date | null;
  now?: Date;
}

// Keyword groups (matched against comparableText, which is normalized/lowercased).
const KW = {
  relevance: ["ایران", "ایرانی", "اتباع خارجی", "مهاجر", "خارجی"],
  residence: ["اقامت", "ایکامت", "ikamet", "شهروندی", "تابعیت", "پاسپورت", "گذرنامه"],
  legal: ["قانون", "مقررات", "بخشنامه", "مصوبه", "دادگاه", "جریمه", "ممنوع", "الزام", "اداره مهاجرت", "goc"],
  financial: ["لیر", "دلار", "ارز", "تورم", "مالیات", "بانک", "قیمت", "اجاره", "حقوق", "دستمزد", "یارانه"],
  urgency: ["فوری", "همین امروز", "لحظاتی پیش", "هم‌اکنون", "اعلام شد", "تعطیل"],
  geo: ["ترکیه", "استانبول", "آنکارا", "یالووا", "ازمیر", "بورسا", "آنتالیا"],
  publicSafety: ["زلزله", "سیل", "آتش", "تصادف", "انفجار", "هشدار", "طوفان", "کولاک", "بیماری", "شیوع"],
  actionable: ["مدارک", "مراحل", "نوبت", "ثبت‌نام", "درخواست", "راهنما", "چگونه", "باید"],
  virality: ["ویدیو", "وایرال", "جنجال", "واکنش", "شگفت"],
  longTerm: ["توافق", "طرح", "پروژه", "چشم‌انداز", "استراتژی", "بلندمدت"],
};

function hits(text: string, words: string[]): number {
  let c = 0;
  for (const w of words) if (text.includes(comparableText(w))) c++;
  return c;
}

/** Map a raw hit count to a 0..1 saturation curve. */
function sat(count: number, at1 = 2): number {
  if (count <= 0) return 0;
  return Math.min(1, count / at1);
}

export function scoreImportance(ctx: ImportanceContext, weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS): ImportanceResult {
  const t = ctx.normalizedText || "";
  const reasons: string[] = [];

  const relevanceHits = hits(t, KW.relevance) + hits(t, KW.residence);
  const relevanceToIraniansInTurkey = Math.min(1, 0.4 * sat(hits(t, KW.relevance), 1) + 0.6 * sat(hits(t, KW.residence), 1) + (relevanceHits ? 0.2 : 0));
  if (relevanceHits) reasons.push("مرتبط با ایرانیان/اقامت در ترکیه");

  const legalImpact = sat(hits(t, KW.legal), 2);
  if (legalImpact > 0) reasons.push("اثر حقوقی/مقرراتی");

  const financialImpact = sat(hits(t, KW.financial), 2);
  if (financialImpact > 0) reasons.push("اثر مالی/اقتصادی");

  const urgency = sat(hits(t, KW.urgency), 1);
  if (urgency > 0) reasons.push("نشانه فوریت");

  const geographicRelevance = sat(hits(t, KW.geo), 1);
  if (geographicRelevance > 0) reasons.push("مرتبط با جغرافیای ترکیه");

  const sourceAuthority = ctx.sourceIsOfficial ? 1 : Math.max(0, Math.min(1, ctx.sourceTrustLevel / 100));
  if (ctx.sourceIsOfficial) reasons.push("منبع رسمی");

  const multiSourceConfirmation = ctx.clusterSourceCount >= 3 ? 1 : ctx.clusterSourceCount === 2 ? 0.6 : 0;
  if (ctx.clusterSourceCount >= 2) reasons.push(`${ctx.clusterSourceCount} منبع تأییدکننده`);

  const novelty = computeNovelty(ctx);
  const publicSafety = sat(hits(t, KW.publicSafety), 1);
  if (publicSafety > 0) reasons.push("ایمنی عمومی");

  const actionability = sat(hits(t, KW.actionable), 2);
  const viralityPotential = sat(hits(t, KW.virality), 1);
  const longTermImportance = sat(hits(t, KW.longTerm), 2);

  const components: ImportanceComponents = {
    relevanceToIraniansInTurkey,
    legalImpact,
    financialImpact,
    urgency,
    geographicRelevance,
    sourceAuthority,
    multiSourceConfirmation,
    novelty,
    publicSafety,
    actionability,
    viralityPotential,
    longTermImportance,
  };

  let total = 0;
  for (const key of Object.keys(components) as (keyof ImportanceComponents)[]) {
    total += components[key] * (weights[key] ?? 0);
  }
  // Guard against custom weights that don't sum to 100.
  const weightSum = Object.values(weights).reduce((a, b) => a + b, 0) || 100;
  const ruleScore = Math.round(Math.max(0, Math.min(100, (total / weightSum) * 100)));

  return { ruleScore, components, reasons };
}

function computeNovelty(ctx: ImportanceContext): number {
  if (!ctx.publishedAt) return 0.5; // unknown → neutral
  const now = ctx.now ?? new Date();
  const ageHours = (now.getTime() - ctx.publishedAt.getTime()) / 3_600_000;
  if (ageHours < 0) return 0.5; // future-dated, treat as neutral
  if (ageHours <= 6) return 1;
  if (ageHours <= 24) return 0.7;
  if (ageHours <= 72) return 0.4;
  return 0.1;
}

/** Map a 0..100 score to the review-queue bucket (thresholds from the spec). */
export type ScoreBucket = "REJECT" | "LOW" | "REVIEW" | "HIGH" | "URGENT";

export function scoreBucket(score: number): ScoreBucket {
  if (score >= 90) return "URGENT";
  if (score >= 75) return "HIGH";
  if (score >= 60) return "REVIEW";
  if (score >= 40) return "LOW";
  return "REJECT";
}
