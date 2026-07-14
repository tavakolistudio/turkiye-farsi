import "server-only";
import { prisma } from "@/lib/db";

/**
 * Read admin-managed site settings (footer text, contact info, socials) from
 * the SiteSetting key/value store. Values are admin-owned; we never fabricate
 * contact details — missing fields simply render nothing.
 */
export interface GeneralSettings {
  siteName?: string;
  description?: string;
  email?: string;
  phone?: string;
  address?: string;
  socials?: { telegram?: string; instagram?: string; x?: string; whatsapp?: string };
}

export interface FooterSettings {
  about?: string;
  copyright?: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export const siteSettingsService = {
  async get(): Promise<{ general: GeneralSettings; footer: FooterSettings }> {
    const rows = await prisma.siteSetting.findMany({
      where: { key: { in: ["general", "footer"] } },
      select: { key: true, value: true },
    });
    const map = new Map(rows.map((r) => [r.key, r.value]));
    return {
      general: asRecord(map.get("general")) as GeneralSettings,
      footer: asRecord(map.get("footer")) as FooterSettings,
    };
  },
};
