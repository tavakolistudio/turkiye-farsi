import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Story clustering. Items covering the same real-world event (from one or more
 * sources) are grouped so trust scoring can count independent confirmations.
 * Exact duplicates are handled upstream (dedup) and never reach here; this deals
 * with the "same story, different source/wording" case.
 */

/** Ensure a single-item cluster exists for a brand-new story. */
export async function createClusterForItem(
  itemId: string,
  normalizedTitle: string,
  clusterKey: string,
): Promise<string> {
  // clusterKey (titleHash) is unique; if a race created it, reuse.
  const existing = await prisma.newsStoryCluster.findUnique({ where: { clusterKey } });
  if (existing) {
    await attach(existing.id, itemId, 1, true);
    return existing.id;
  }
  const cluster = await prisma.newsStoryCluster.create({
    data: {
      clusterKey,
      representativeItemId: itemId,
      normalizedTopic: normalizedTitle.slice(0, 200),
      sourceCount: 1,
      confidence: 1,
      status: "OPEN",
    },
  });
  await attach(cluster.id, itemId, 1, true);
  return cluster.id;
}

/**
 * Add a new item to the cluster that already contains `siblingItemId`. Recounts
 * distinct sources so multi-source confirmation reflects reality. Returns the
 * cluster id, or null if the sibling isn't clustered yet.
 */
export async function addItemToClusterOf(
  siblingItemId: string,
  newItemId: string,
  similarity: number,
): Promise<string | null> {
  const link = await prisma.newsStoryClusterItem.findFirst({
    where: { newsItemId: siblingItemId },
    select: { clusterId: true },
  });
  if (!link) return null;
  await attach(link.clusterId, newItemId, similarity, false);
  await recount(link.clusterId);
  return link.clusterId;
}

async function attach(clusterId: string, itemId: string, similarity: number, isPrimary: boolean) {
  await prisma.newsStoryClusterItem.upsert({
    where: { clusterId_newsItemId: { clusterId, newsItemId: itemId } },
    create: { clusterId, newsItemId: itemId, similarityScore: similarity, isPrimary },
    update: { similarityScore: similarity },
  });
}

async function recount(clusterId: string) {
  const links = await prisma.newsStoryClusterItem.findMany({
    where: { clusterId },
    select: { newsItem: { select: { sourceId: true } } },
  });
  const distinctSources = new Set(links.map((l) => l.newsItem.sourceId)).size;
  await prisma.newsStoryCluster.update({
    where: { id: clusterId },
    data: { sourceCount: distinctSources, lastSeenAt: new Date() },
  });
}

/** Count distinct sources currently in a cluster. */
export async function clusterSourceCount(clusterId: string): Promise<number> {
  const links = await prisma.newsStoryClusterItem.findMany({
    where: { clusterId },
    select: { newsItem: { select: { sourceId: true } } },
  });
  return new Set(links.map((l) => l.newsItem.sourceId)).size;
}

/**
 * Recompute a cluster's derived fields (sourceCount, representativeItemId,
 * confidence, lastSeenAt) from its current membership, inside a transaction.
 * Picks the primary item as representative, else the earliest. Confidence is the
 * mean similarity of members. Returns the remaining member count.
 */
export async function recomputeCluster(tx: Prisma.TransactionClient, clusterId: string): Promise<number> {
  const links = await tx.newsStoryClusterItem.findMany({
    where: { clusterId },
    select: { newsItemId: true, similarityScore: true, isPrimary: true, newsItem: { select: { sourceId: true, createdAt: true } } },
    orderBy: { createdAt: "asc" },
  });
  if (links.length === 0) return 0;
  const distinctSources = new Set(links.map((l) => l.newsItem.sourceId)).size;
  const primary = links.find((l) => l.isPrimary) ?? links[0];
  const confidence = links.reduce((a, l) => a + l.similarityScore, 0) / links.length;
  // Ensure exactly one primary flag.
  if (!links.some((l) => l.isPrimary)) {
    await tx.newsStoryClusterItem.update({
      where: { clusterId_newsItemId: { clusterId, newsItemId: primary.newsItemId } },
      data: { isPrimary: true },
    });
  }
  await tx.newsStoryCluster.update({
    where: { id: clusterId },
    data: { sourceCount: distinctSources, representativeItemId: primary.newsItemId, confidence, lastSeenAt: new Date() },
  });
  return links.length;
}
