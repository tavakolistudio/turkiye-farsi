export function isPublicArticle(article: { status: string; publishedAt: Date | null; deletedAt: Date | null }, now = new Date()) {
  return article.status === "PUBLISHED" && article.deletedAt === null && article.publishedAt !== null && article.publishedAt <= now;
}

export function relatedArticleScore(input: { sameCategory: boolean; sharedTags: number; publishedAt: Date | null }, now = new Date()) {
  const ageInMonths = input.publishedAt ? (now.getTime() - input.publishedAt.getTime()) / 86_400_000 / 30 : 100;
  return (input.sameCategory ? 10 : 0) + Math.max(0, input.sharedTags) * 3 + Math.max(0, 2 - ageInMonths);
}

export function isBotUserAgent(userAgent: string | null | undefined) {
  return /bot|crawler|spider|slurp|headless|preview/i.test(userAgent ?? "");
}

export const VIEW_DEDUPLICATION_MS = 30 * 60_000;
