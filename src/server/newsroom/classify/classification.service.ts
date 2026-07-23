import type { ClassificationResult } from "../types";
import { comparableText } from "../normalize/persian";

/**
 * Rule-based topic classification. CRITICAL RULE: it may only ever SUGGEST from
 * categories/tags that already exist — it never creates taxonomy. When no
 * existing category matches with confidence, `needsReview` is set and
 * `primaryCategorySlug` is left null for a human to decide.
 *
 * (The AI classifier, when enabled, is likewise constrained to the provided
 * existing-category list and its output is validated against it.)
 */

export interface TaxonomyEntry {
  slug: string;
  name: string;
}

/** Signal keywords → the category NAME/slug fragments they imply. */
const TOPIC_KEYWORDS: { match: string[]; hint: string[] }[] = [
  { match: ["اقامت", "ایکامت", "ikamet"], hint: ["اقامت", "residence"] },
  { match: ["مهاجرت", "اداره مهاجرت", "goc"], hint: ["مهاجرت", "قوانین", "residence"] },
  { match: ["شهروندی", "تابعیت", "پاسپورت ترکیه"], hint: ["شهروندی", "قوانین"] },
  { match: ["قانون", "مقررات", "بخشنامه", "مصوبه"], hint: ["قوانین", "قانون"] },
  { match: ["لیر", "دلار", "ارز", "تورم"], hint: ["اقتصاد", "ارز", "لیر"] },
  { match: ["مالیات", "بانک", "حساب بانکی"], hint: ["اقتصاد", "بانک", "مالیات"] },
  { match: ["ملک", "خانه", "اجاره", "آپارتمان"], hint: ["ملک", "اقتصاد"] },
  { match: ["کار", "استخدام", "شغل", "حقوق"], hint: ["کار", "اقتصاد"] },
  { match: ["پرواز", "ویزا", "فرودگاه"], hint: ["پرواز", "ویزا", "گردشگری"] },
  { match: ["گمرک"], hint: ["گمرک", "قوانین"] },
  { match: ["استانبول"], hint: ["استانبول"] },
  { match: ["یالووا"], hint: ["یالووا"] },
  { match: ["گردشگری", "سفر", "تور"], hint: ["گردشگری"] },
  { match: ["ایران و ترکیه", "روابط"], hint: ["روابط", "اخبار"] },
  { match: ["ترکیه"], hint: ["اخبار ترکیه", "ترکیه", "اخبار"] },
];

export function classify(text: string, categories: TaxonomyEntry[], tags: TaxonomyEntry[]): ClassificationResult {
  const t = comparableText(text);
  const catScores = new Map<string, number>();

  for (const group of TOPIC_KEYWORDS) {
    const matched = group.match.some((m) => t.includes(comparableText(m)));
    if (!matched) continue;
    for (const hint of group.hint) {
      const cat = findCategory(categories, hint);
      if (cat) catScores.set(cat.slug, (catScores.get(cat.slug) ?? 0) + 1);
    }
  }

  const ranked = [...catScores.entries()].sort((a, b) => b[1] - a[1]);
  const primaryCategorySlug = ranked[0]?.[0] ?? null;
  const secondaryCategorySlugs = ranked.slice(1, 3).map(([slug]) => slug);

  // Tags: only existing tags whose name appears in the text.
  const suggestedTagSlugs = tags
    .filter((tag) => t.includes(comparableText(tag.name)))
    .slice(0, 6)
    .map((tag) => tag.slug);

  const geographicScope = t.includes(comparableText("استانبول"))
    ? "استانبول"
    : t.includes(comparableText("یالووا"))
      ? "یالووا"
      : t.includes(comparableText("ترکیه"))
        ? "ترکیه"
        : null;

  const sensitivityLevel: ClassificationResult["sensitivityLevel"] =
    /حقوق|قانون|مهاجرت|اقامت|شهروندی|جریمه|اخراج/.test(text) ? "HIGH" : "LOW";

  return {
    primaryCategorySlug,
    secondaryCategorySlugs,
    suggestedTagSlugs,
    affectedAudience: /ایران|اتباع|مهاجر/.test(text) ? "ایرانیان مقیم ترکیه" : null,
    geographicScope,
    contentType: null,
    sensitivityLevel,
    needsReview: primaryCategorySlug === null,
  };
}

function findCategory(categories: TaxonomyEntry[], hint: string): TaxonomyEntry | undefined {
  const h = comparableText(hint);
  return (
    categories.find((c) => comparableText(c.slug) === h) ??
    categories.find((c) => comparableText(c.name).includes(h) || h.includes(comparableText(c.name)))
  );
}
