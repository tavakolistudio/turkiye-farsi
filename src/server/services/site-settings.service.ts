import "server-only";
import { cache } from "react";
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
  logo?: string;
  alternateName?: string;
  foundingDate?: string;
  socials?: { telegram?: string; instagram?: string; x?: string; whatsapp?: string };
}

export interface FooterSettings {
  about?: string;
  copyright?: string;
}

/** Public-safe publisher/organization facts, all real (no fabricated values). */
export interface PublisherInfo {
  siteName?: string;
  alternateName?: string;
  description?: string;
  logo?: string;
  foundingDate?: string;
  /** Absolute social URLs only (handles/blank values are dropped). */
  sameAs: string[];
  contactEmail?: string;
  contactPhone?: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

const str = (v: unknown): string | undefined => {
  const s = typeof v === "string" ? v.trim() : "";
  return s || undefined;
};

export const siteSettingsService = {
  get: cache(async (): Promise<{ general: GeneralSettings; footer: FooterSettings }> => {
    const rows = await prisma.siteSetting.findMany({
      where: { key: { in: ["general", "footer"] } },
      select: { key: true, value: true },
    });
    const map = new Map(rows.map((r) => [r.key, r.value]));
    return {
      general: asRecord(map.get("general")) as GeneralSettings,
      footer: asRecord(map.get("footer")) as FooterSettings,
    };
  }),

  /**
   * Publisher facts for Organization structured data. Only genuinely-present
   * values are returned; social links are included only when they are absolute
   * URLs so we never invent a profile URL from a handle.
   */
  async publisher(): Promise<PublisherInfo> {
    const { general } = await this.get();
    const socials = asRecord(general.socials);
    const sameAs = Object.values(socials)
      .map((v) => str(v))
      .filter((v): v is string => !!v && /^https?:\/\//i.test(v));
    return {
      siteName: str(general.siteName),
      alternateName: str(general.alternateName),
      description: str(general.description),
      logo: str(general.logo),
      foundingDate: str(general.foundingDate),
      sameAs,
      contactEmail: str(general.email),
      contactPhone: str(general.phone),
    };
  },
};
