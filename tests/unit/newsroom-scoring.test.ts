import { describe, it, expect } from "vitest";
import { titleSimilarity, jaccard, levenshteinRatio } from "@/server/newsroom/dedup/similarity";
import { bestFuzzyMatch } from "@/server/newsroom/dedup/duplicate.service";
import { scoreImportance, scoreBucket } from "@/server/newsroom/scoring/importance.service";
import { evaluateTrust } from "@/server/newsroom/scoring/trust.service";
import { DEFAULT_SCORING_WEIGHTS } from "@/server/newsroom/settings";

describe("similarity + fuzzy match", () => {
  it("scores identical titles as 1 and unrelated low", () => {
    expect(titleSimilarity("افزایش قیمت لیر", "افزایش قیمت لیر")).toBe(1);
    expect(titleSimilarity("افزایش قیمت لیر", "نتایج فوتبال دیشب")).toBeLessThan(0.4);
  });
  it("jaccard and levenshtein are bounded 0..1", () => {
    expect(jaccard("a b c", "a b")).toBeGreaterThan(0);
    expect(levenshteinRatio("kitten", "sitting")).toBeGreaterThan(0);
    expect(levenshteinRatio("abc", "")).toBe(0);
  });
  it("bestFuzzyMatch returns the closest above threshold", () => {
    const m = bestFuzzyMatch("افزایش قیمت لیر ترکیه", [
      { id: "a", normalizedTitle: "نتایج بازی" },
      { id: "b", normalizedTitle: "افزایش قیمت لیر در ترکیه" },
    ], 0.8);
    expect(m?.id).toBe("b");
  });
});

describe("importance scoring", () => {
  it("scores a relevant legal/residence story higher than noise", () => {
    const relevant = scoreImportance({
      normalizedText: "اداره مهاجرت قانون تازه اقامت ایرانیان در ترکیه را اعلام کرد",
      sourceTrustLevel: 80, sourceIsOfficial: true, clusterSourceCount: 2, publishedAt: new Date(),
    });
    const noise = scoreImportance({
      normalizedText: "نتایج قرعه‌کشی هفتگی",
      sourceTrustLevel: 30, sourceIsOfficial: false, clusterSourceCount: 1, publishedAt: new Date(),
    });
    expect(relevant.ruleScore).toBeGreaterThan(noise.ruleScore);
    expect(relevant.reasons.length).toBeGreaterThan(0);
    expect(relevant.ruleScore).toBeGreaterThanOrEqual(0);
    expect(relevant.ruleScore).toBeLessThanOrEqual(100);
  });
  it("respects configurable weights (zeroing relevance lowers the score)", () => {
    const ctx = {
      normalizedText: "قانون اقامت ایرانیان ترکیه",
      sourceTrustLevel: 50, sourceIsOfficial: false, clusterSourceCount: 1, publishedAt: new Date(),
    };
    const base = scoreImportance(ctx, DEFAULT_SCORING_WEIGHTS);
    const zeroed = scoreImportance(ctx, { ...DEFAULT_SCORING_WEIGHTS, relevanceToIraniansInTurkey: 0 });
    expect(zeroed.ruleScore).toBeLessThan(base.ruleScore);
  });
  it("maps scores to the right buckets", () => {
    expect(scoreBucket(95)).toBe("URGENT");
    expect(scoreBucket(80)).toBe("HIGH");
    expect(scoreBucket(65)).toBe("REVIEW");
    expect(scoreBucket(45)).toBe("LOW");
    expect(scoreBucket(20)).toBe("REJECT");
  });
});

describe("trust evaluation", () => {
  it("caps social-media-only stories at SINGLE_SOURCE", () => {
    const r = evaluateTrust({
      sources: [{ sourceType: "SOCIAL_MEDIA", isOfficial: false, trustLevel: 40, hasArticleUrl: false }],
      hasLegalClaim: false,
    });
    expect(r.verificationStatus).toBe("SINGLE_SOURCE");
    expect(r.socialOnly).toBe(true);
    expect(r.trustScore).toBeLessThanOrEqual(35);
  });
  it("marks OFFICIAL_CONFIRMED when an official source is present", () => {
    const r = evaluateTrust({
      sources: [{ sourceType: "OFFICIAL", isOfficial: true, trustLevel: 90, hasArticleUrl: true }],
      hasLegalClaim: true,
    });
    expect(r.verificationStatus).toBe("OFFICIAL_CONFIRMED");
    expect(r.requiresHumanFactCheck).toBe(false);
  });
  it("flags a legal claim without an official source for human fact-check", () => {
    const r = evaluateTrust({
      sources: [{ sourceType: "MEDIA", isOfficial: false, trustLevel: 60, hasArticleUrl: true }],
      hasLegalClaim: true,
    });
    expect(r.requiresHumanFactCheck).toBe(true);
  });
  it("marks CONFLICTING when the caller signals disagreeing sources", () => {
    // No caller sets `conflicting` yet (claim-vs-claim comparison isn't built),
    // but the status and its downstream notification must work the day one does.
    const r = evaluateTrust({
      sources: [
        { sourceType: "MEDIA", isOfficial: false, trustLevel: 60, hasArticleUrl: true },
        { sourceType: "MEDIA", isOfficial: false, trustLevel: 55, hasArticleUrl: true },
      ],
      hasLegalClaim: false,
      conflicting: true,
    });
    expect(r.verificationStatus).toBe("CONFLICTING");
    expect(r.requiresHumanFactCheck).toBe(true);
    expect(r.trustScore).toBeLessThanOrEqual(30);
  });
});
