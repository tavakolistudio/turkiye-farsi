import "server-only";
import type { NotificationType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ROLES } from "@/server/rbac/permissions";

/**
 * Internal (in-app) newsroom notifications. Recipients are editorial leads
 * (super admins + editors-in-chief). No email/push/Telegram in this phase.
 * Never throws — notifications must not break the pipeline.
 */

async function editorialRecipients(): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      roles: { some: { role: { key: { in: [ROLES.SUPER_ADMIN, ROLES.EDITOR_IN_CHIEF] } } } },
    },
    select: { id: true },
    take: 50,
  });
  return users.map((u) => u.id);
}

export async function notifyEditorial(
  type: NotificationType,
  message: string,
  opts: { articleId?: string | null } = {},
): Promise<void> {
  try {
    const recipients = await editorialRecipients();
    if (recipients.length === 0) return;
    await prisma.notification.createMany({
      data: recipients.map((userId) => ({
        userId,
        type,
        message: message.slice(0, 500),
        articleId: opts.articleId ?? null,
      })),
    });
  } catch (e) {
    console.error("[newsroom] notify failed:", e);
  }
}
