import "server-only";
import { prisma } from "@/lib/db";
import { titleSimilarity } from "./similarity";

/**
 * Multi-level duplicate detection. Levels 1-4 are always active; Level 5
 * (semantic embeddings) is an explicit extension point that stays disabled
 * until an embedding provider is configured. Thresholds are configurable.
 */

export interface DuplicateCandidate {
  sourceId: string;
  externalId: string;
  canonicalUrl: string | null;
  titleHash: string;
  normalizedTitle: string;
  publishedAt?: Date | null;
}

export interface DuplicateMatch {
  duplicateOfId: string;
  level: 1 | 2 | 3 | 4 | 5;
  similarity: number;
}

export interface DuplicateOptions {
  /** Fuzzy match threshold in [0,1]. */
  fuzzyThreshold?: number;
  /** How far back to scan for fuzzy matches. */
  lookbackHours?: number;
  now?: Date;
}

const DEFAULTS = { fuzzyThreshold: 0.85, lookbackHours: 72 };

export async function findDuplicate(
  candidate: DuplicateCandidate,
  opts: DuplicateOptions = {},
): Promise<DuplicateMatch | null> {
  const fuzzyThreshold = opts.fuzzyThreshold ?? DEFAULTS.fuzzyThreshold;
  const lookbackHours = opts.lookbackHours ?? DEFAULTS.lookbackHours;
  const now = opts.now ?? new Date();

  // Level 1 — exact canonical URL.
  if (candidate.canonicalUrl) {
    const byUrl = await prisma.ingestedNewsItem.findFirst({
      where: { canonicalUrl: candidate.canonicalUrl },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    if (byUrl) return { duplicateOfId: byUrl.id, level: 1, similarity: 1 };
  }

  // Level 2 — same (sourceId, externalId). The DB unique constraint prevents a
  // true re-insert; this catches it pre-insert so the pipeline can skip cleanly.
  const bySource = await prisma.ingestedNewsItem.findFirst({
    where: { sourceId: candidate.sourceId, externalId: candidate.externalId },
    select: { id: true },
  });
  if (bySource) return { duplicateOfId: bySource.id, level: 2, similarity: 1 };

  // Level 3 — exact normalized-title hash.
  const byHash = await prisma.ingestedNewsItem.findFirst({
    where: { titleHash: candidate.titleHash },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  if (byHash) return { duplicateOfId: byHash.id, level: 3, similarity: 1 };

  // Level 4 — fuzzy title similarity against recent items.
  const since = new Date(now.getTime() - lookbackHours * 3_600_000);
  const recent = await prisma.ingestedNewsItem.findMany({
    where: { createdAt: { gte: since }, ingestionStatus: { not: "REJECTED" } },
    select: { id: true, normalizedTitle: true },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  const best = bestFuzzyMatch(candidate.normalizedTitle, recent, fuzzyThreshold);
  if (best) return { duplicateOfId: best.id, level: 4, similarity: best.similarity };

  return null;
}

/** Pure fuzzy scan — returns the best match above the threshold, or null. */
export function bestFuzzyMatch(
  normalizedTitle: string,
  items: { id: string; normalizedTitle: string | null }[],
  threshold: number,
): { id: string; similarity: number } | null {
  let best: { id: string; similarity: number } | null = null;
  for (const it of items) {
    if (!it.normalizedTitle) continue;
    const sim = titleSimilarity(normalizedTitle, it.normalizedTitle);
    if (sim >= threshold && (!best || sim > best.similarity)) {
      best = { id: it.id, similarity: sim };
    }
  }
  return best;
}
