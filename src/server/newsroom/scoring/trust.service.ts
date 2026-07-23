import type { TrustResult, TrustVerification } from "../types";

/**
 * Trust / verification evaluation. Deterministic rules that never over-claim:
 *  - social-media-only stories cap at SINGLE_SOURCE,
 *  - legal/immigration claims without an official source are flagged for human
 *    fact-check (never silently trusted),
 *  - conflicting claims across sources downgrade to CONFLICTING.
 *
 * This does NOT assert a story is factually true; it measures how well-sourced
 * it is and whether a human must verify it. Pure — no I/O.
 */

export interface ClusterSourceInfo {
  sourceType: string; // Prisma SourceType
  isOfficial: boolean;
  trustLevel: number; // 0..100
  hasArticleUrl: boolean;
}

export interface TrustContext {
  sources: ClusterSourceInfo[];
  /** True if the story text makes a legal/immigration/regulatory claim. */
  hasLegalClaim: boolean;
  /**
   * Set when sources visibly disagree (e.g. differing numbers/outcomes).
   * TODO: no caller sets this yet — detecting disagreement requires comparing
   * extracted claims across clustered items, which isn't built. Once it is,
   * this flag (and the NEWSROOM_SOURCE_CONFLICT notification already wired to
   * `verificationStatus === "CONFLICTING"` in pipeline.service.ts and
   * newsroom.service.ts#reprocessItem) will work with no further changes.
   */
  conflicting?: boolean;
}

const SOCIAL = new Set(["SOCIAL_MEDIA", "USER_SUBMITTED"]);

export function evaluateTrust(ctx: TrustContext): TrustResult {
  const sources = ctx.sources ?? [];
  const reasonCodes: string[] = [];

  const officialSourceCount = sources.filter((s) => s.isOfficial || s.sourceType === "OFFICIAL" || s.sourceType === "GOVERNMENT").length;
  const nonSocial = sources.filter((s) => !SOCIAL.has(s.sourceType));
  const independentSourceCount = nonSocial.length;
  const socialOnly = sources.length > 0 && nonSocial.length === 0;
  const primarySourceAvailable = officialSourceCount > 0 || sources.some((s) => s.hasArticleUrl && s.trustLevel >= 70);
  const conflictingClaims = !!ctx.conflicting;

  let verificationStatus: TrustVerification;
  if (sources.length === 0) {
    verificationStatus = "UNVERIFIED";
    reasonCodes.push("بدون منبع");
  } else if (conflictingClaims) {
    verificationStatus = "CONFLICTING";
    reasonCodes.push("ادعاهای متناقض میان منابع");
  } else if (officialSourceCount > 0) {
    verificationStatus = "OFFICIAL_CONFIRMED";
    reasonCodes.push("تأیید منبع رسمی");
  } else if (independentSourceCount >= 2) {
    verificationStatus = "MULTI_SOURCE";
    reasonCodes.push("چند منبع مستقل");
  } else if (socialOnly) {
    verificationStatus = "SINGLE_SOURCE";
    reasonCodes.push("فقط شبکه اجتماعی — حداکثر تک‌منبع");
  } else {
    verificationStatus = "SINGLE_SOURCE";
    reasonCodes.push("تنها یک منبع");
  }

  // Legal/immigration claims require an official source to avoid misleading users.
  const requiresHumanFactCheck =
    conflictingClaims ||
    (ctx.hasLegalClaim && officialSourceCount === 0) ||
    verificationStatus === "SINGLE_SOURCE" ||
    verificationStatus === "UNVERIFIED";
  if (ctx.hasLegalClaim && officialSourceCount === 0) {
    reasonCodes.push("ادعای حقوقی/مهاجرتی بدون منبع رسمی — نیازمند بررسی انسانی");
  }

  const trustScore = computeScore({
    officialSourceCount,
    independentSourceCount,
    socialOnly,
    conflictingClaims,
    avgTrust: sources.length ? sources.reduce((a, s) => a + s.trustLevel, 0) / sources.length : 0,
    primarySourceAvailable,
  });

  return {
    trustScore,
    verificationStatus,
    officialSourceCount,
    independentSourceCount,
    socialOnly,
    conflictingClaims,
    primarySourceAvailable,
    requiresHumanFactCheck,
    reasonCodes,
  };
}

function computeScore(x: {
  officialSourceCount: number;
  independentSourceCount: number;
  socialOnly: boolean;
  conflictingClaims: boolean;
  avgTrust: number;
  primarySourceAvailable: boolean;
}): number {
  let s = 0;
  s += Math.min(40, x.avgTrust * 0.4); // base from source trust
  s += Math.min(30, x.officialSourceCount * 20); // official confirmation
  s += Math.min(20, Math.max(0, x.independentSourceCount - 1) * 10); // corroboration
  if (x.primarySourceAvailable) s += 10;
  if (x.socialOnly) s = Math.min(s, 35);
  if (x.conflictingClaims) s = Math.min(s, 30);
  return Math.round(Math.max(0, Math.min(100, s)));
}
