import "server-only";
import type { DeviceType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { publishedWhere } from "@/server/data/article.repo";

/**
 * Article view tracking. Deliberately privacy-light: we store a rotating,
 * non-identifying session key (not an IP or a fingerprint) purely to
 * de-duplicate refreshes. Counting only happens for genuinely-published
 * articles, never for bots, and any failure is swallowed by the caller so a
 * tracking hiccup can never break the page.
 */

const BOT_RE = /bot|crawler|spider|crawl|slurp|bingpreview|facebookexternalhit|whatsapp|telegrambot|preview|monitor|headless|lighthouse|pingdom|semrush|ahrefs/i;
const TABLET_RE = /ipad|tablet|playbook|silk|(android(?!.*mobile))/i;
const MOBILE_RE = /mobile|iphone|ipod|android.*mobile|blackberry|iemobile|opera mini/i;

/** Coarse device classification from the User-Agent — no fingerprinting. */
export function classifyDevice(userAgent: string | null | undefined): DeviceType {
  const ua = userAgent ?? "";
  if (!ua) return "UNKNOWN";
  if (BOT_RE.test(ua)) return "BOT";
  if (TABLET_RE.test(ua)) return "TABLET";
  if (MOBILE_RE.test(ua)) return "MOBILE";
  return "DESKTOP";
}

export function isBot(userAgent: string | null | undefined): boolean {
  return BOT_RE.test(userAgent ?? "");
}

/** Only count one view per (article, session) within this window. */
const DEDUP_WINDOW_MS = 6 * 60 * 60 * 1000;

export const viewService = {
  /**
   * Record a view for a published article. Returns whether the view was
   * counted (so the client can react, though it never needs to). Bots and
   * repeat views within the dedup window are recorded-but-not-counted / skipped.
   */
  async recordView(opts: {
    slug: string;
    sessionKey: string;
    userAgent?: string | null;
    referrer?: string | null;
    path: string;
  }): Promise<{ counted: boolean }> {
    if (isBot(opts.userAgent)) return { counted: false };

    const article = await prisma.article.findFirst({
      where: publishedWhere({ slug: opts.slug }),
      select: { id: true },
    });
    if (!article) return { counted: false };

    // De-duplicate rapid refreshes from the same session.
    const since = new Date(Date.now() - DEDUP_WINDOW_MS);
    const recent = await prisma.pageView.findFirst({
      where: { articleId: article.id, sessionKey: opts.sessionKey, createdAt: { gte: since } },
      select: { id: true },
    });
    if (recent) return { counted: false };

    await prisma.$transaction([
      prisma.pageView.create({
        data: {
          articleId: article.id,
          path: opts.path.slice(0, 500),
          referrer: opts.referrer?.slice(0, 500) ?? null,
          deviceType: classifyDevice(opts.userAgent),
          sessionKey: opts.sessionKey,
        },
      }),
      prisma.article.update({ where: { id: article.id }, data: { viewCount: { increment: 1 } } }),
    ]);

    return { counted: true };
  },
};
