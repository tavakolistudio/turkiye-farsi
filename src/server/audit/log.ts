import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

/**
 * Append an entry to the Audit Log. Never throws — auditing must not break the
 * primary operation. Sensitive changes may include before/after snapshots.
 */
export async function auditLog(entry: {
  userId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  ip?: string | null;
  userAgent?: string | null;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        ip: entry.ip ?? null,
        userAgent: entry.userAgent ?? null,
        before: entry.before,
        after: entry.after,
      },
    });
  } catch (err) {
    console.error("[audit] failed to write log:", err);
  }
}
