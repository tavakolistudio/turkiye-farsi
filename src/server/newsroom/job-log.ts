import "server-only";
import type { Prisma, NewsPipelineStage, NewsJobStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Structured, secret-free per-stage logging for the pipeline. Never stores raw
 * source responses, prompts or secrets — only a stage, status, safe message and
 * small metadata. Never throws (logging must not break the pipeline).
 */

const SECRET_RE = /(sk-[A-Za-z0-9]{8,}|bearer\s+\S+|api[_-]?key\S*|postgres(ql)?:\/\/\S+)/gi;

export function safeMessage(err: unknown, max = 300): string {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  return raw.replace(SECRET_RE, "[redacted]").slice(0, max);
}

export async function logJob(entry: {
  batchId?: string | null;
  newsItemId?: string | null;
  stage: NewsPipelineStage;
  status: NewsJobStatus;
  attempt?: number;
  errorCode?: string | null;
  error?: unknown;
  metadata?: Prisma.InputJsonValue;
  startedAt?: Date;
}): Promise<void> {
  try {
    await prisma.newsPipelineJobLog.create({
      data: {
        batchId: entry.batchId ?? null,
        newsItemId: entry.newsItemId ?? null,
        stage: entry.stage,
        status: entry.status,
        attempt: entry.attempt ?? 1,
        startedAt: entry.startedAt ?? new Date(),
        completedAt: new Date(),
        errorCode: entry.errorCode ?? null,
        errorMessageSafe: entry.error ? safeMessage(entry.error) : null,
        metadataJson: entry.metadata,
      },
    });
  } catch (e) {
    console.error("[newsroom] job log failed:", e);
  }
}
