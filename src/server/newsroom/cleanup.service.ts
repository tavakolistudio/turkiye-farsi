import "server-only";
import { prisma } from "@/lib/db";
import { newsroomSettingsService } from "./settings";
import { logJob } from "./job-log";

/**
 * Retention cleanup. Conservative and reversible-where-possible:
 *  - REJECTED ingested items older than `retentionDays` are SOFT-deleted
 *    (deletedAt set) — never hard-deleted, so nothing referenced by a draft is
 *    lost.
 *  - Old pipeline job logs are archived (deleted) past the same window.
 *  - Draft provenance, Articles, Revisions, ArticleSource attribution and Source
 *    URLs are NEVER touched.
 *
 * Supports a dry-run (counts only, no writes), processes in batches, is
 * idempotent, and takes a Postgres advisory lock so two runs never overlap.
 */

const CLEANUP_LOCK_KEY = 918273; // arbitrary, stable advisory-lock id
const BATCH = 500;

export interface CleanupReport {
  dryRun: boolean;
  locked: boolean;
  retentionDays: number;
  cutoff: string;
  rejectedItemsReviewed: number;
  rejectedItemsSoftDeleted: number;
  jobLogsArchived: number;
}

export async function runCleanup(opts: { dryRun: boolean }): Promise<CleanupReport> {
  const settings = await newsroomSettingsService.get();
  const cutoff = new Date(Date.now() - settings.retentionDays * 86_400_000);
  const base: CleanupReport = {
    dryRun: opts.dryRun,
    locked: false,
    retentionDays: settings.retentionDays,
    cutoff: cutoff.toISOString(),
    rejectedItemsReviewed: 0,
    rejectedItemsSoftDeleted: 0,
    jobLogsArchived: 0,
  };

  // Candidate counts (also the dry-run result).
  const rejectedWhere = { ingestionStatus: "REJECTED" as const, deletedAt: null, createdAt: { lt: cutoff } };
  base.rejectedItemsReviewed = await prisma.ingestedNewsItem.count({ where: rejectedWhere });
  const oldLogsWhere = { startedAt: { lt: cutoff } };
  const oldLogsCount = await prisma.newsPipelineJobLog.count({ where: oldLogsWhere });

  if (opts.dryRun) {
    return { ...base, jobLogsArchived: oldLogsCount };
  }

  // Serialize real runs with an advisory lock; skip if another run holds it.
  const lock = await prisma.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_lock(${CLEANUP_LOCK_KEY}) AS locked`;
  if (!lock[0]?.locked) {
    await logJob({ stage: "NOTIFY", status: "SKIPPED", metadata: { cleanup: "lock_held" } });
    return { ...base, locked: false };
  }

  try {
    // Soft-delete rejected items in batches (idempotent — re-running skips them).
    let softDeleted = 0;
    for (;;) {
      const batch = await prisma.ingestedNewsItem.findMany({ where: rejectedWhere, select: { id: true }, take: BATCH });
      if (batch.length === 0) break;
      const res = await prisma.ingestedNewsItem.updateMany({
        where: { id: { in: batch.map((b) => b.id) } },
        data: { deletedAt: new Date() },
      });
      softDeleted += res.count;
      if (batch.length < BATCH) break;
    }

    // Archive (delete) old job logs in batches.
    let logsArchived = 0;
    for (;;) {
      const batch = await prisma.newsPipelineJobLog.findMany({ where: oldLogsWhere, select: { id: true }, take: BATCH });
      if (batch.length === 0) break;
      const res = await prisma.newsPipelineJobLog.deleteMany({ where: { id: { in: batch.map((b) => b.id) } } });
      logsArchived += res.count;
      if (batch.length < BATCH) break;
    }

    await logJob({ stage: "NOTIFY", status: "SUCCESS", metadata: { cleanup: true, softDeleted, logsArchived } });
    return { ...base, locked: true, rejectedItemsSoftDeleted: softDeleted, jobLogsArchived: logsArchived };
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(${CLEANUP_LOCK_KEY})`;
  }
}
