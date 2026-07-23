/**
 * Shared, typed I/O for the newsroom pipeline. Each stage consumes and produces
 * one of these shapes so stages stay independently testable and composable.
 */

/** A raw item as pulled from a feed, before normalization. */
export interface ParsedFeedItem {
  /** Stable per-source id: feed guid/id, else the link. */
  externalId: string;
  title: string;
  link: string;
  /** Short summary/description as provided by the feed (may contain HTML). */
  summary?: string;
  author?: string;
  publishedAt?: Date;
  updatedAt?: Date;
  /** Non-sensitive extra fields we choose to keep (categories, enclosure type…). */
  meta?: Record<string, string | string[]>;
}

export interface ParsedFeed {
  title?: string;
  items: ParsedFeedItem[];
}

/** The audience-relevance taxonomy for "Iranians in Turkey". */
export const NEWSROOM_TOPICS = [
  "اقامت",
  "مهاجرت",
  "شهروندی",
  "قوانین ترکیه",
  "اقتصاد ترکیه",
  "لیر و ارز",
  "بانک و مالیات",
  "ملک",
  "کار و استخدام",
  "آموزش",
  "سلامت",
  "حمل‌ونقل",
  "پرواز و ویزا",
  "گمرک",
  "روابط ایران و ترکیه",
  "اخبار ایران",
  "اخبار ترکیه",
  "یالووا",
  "استانبول",
  "گردشگری",
  "فناوری و هوش مصنوعی",
  "ورزش مهم",
  "حوادث",
  "خبر فوری",
  "سایر",
] as const;

export type NewsroomTopic = (typeof NEWSROOM_TOPICS)[number];

export interface ImportanceComponents {
  relevanceToIraniansInTurkey: number;
  legalImpact: number;
  financialImpact: number;
  urgency: number;
  geographicRelevance: number;
  sourceAuthority: number;
  multiSourceConfirmation: number;
  novelty: number;
  publicSafety: number;
  actionability: number;
  viralityPotential: number;
  longTermImportance: number;
}

export type ScoringWeights = ImportanceComponents;

export interface ImportanceResult {
  /** 0..100 rule-based score. */
  ruleScore: number;
  components: ImportanceComponents;
  /** Short, human-readable reason codes explaining the score. */
  reasons: string[];
}

export type TrustVerification =
  | "UNVERIFIED"
  | "SINGLE_SOURCE"
  | "MULTI_SOURCE"
  | "OFFICIAL_CONFIRMED"
  | "CONFLICTING"
  | "REJECTED";

export interface TrustResult {
  trustScore: number; // 0..100
  verificationStatus: TrustVerification;
  officialSourceCount: number;
  independentSourceCount: number;
  socialOnly: boolean;
  conflictingClaims: boolean;
  primarySourceAvailable: boolean;
  requiresHumanFactCheck: boolean;
  reasonCodes: string[];
}

export interface ClassificationResult {
  primaryCategorySlug: string | null;
  secondaryCategorySlugs: string[];
  suggestedTagSlugs: string[];
  affectedAudience: string | null;
  geographicScope: string | null;
  contentType: string | null;
  sensitivityLevel: "LOW" | "MEDIUM" | "HIGH";
  needsReview: boolean;
}
