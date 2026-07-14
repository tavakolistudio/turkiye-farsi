import type {
  ContentType,
  ArticleStatus,
  FactCheckStatus,
  ArticleSourceStatus,
  SourceType,
  CredibilityLevel,
  MediaRole,
} from "@prisma/client";

/**
 * Runtime arrays of the Prisma enum values, kept as the single source for Zod
 * schemas and UI selects. The `satisfies` clauses make the compiler fail if an
 * array drifts out of sync with the Prisma enum — keeping DB and TS aligned.
 * (Type-only imports are erased, so this stays safe to import on the client.)
 */
export const CONTENT_TYPES = [
  "SHORT_NEWS",
  "NEWS",
  "ARTICLE",
  "ANALYSIS",
  "GUIDE",
  "NOTICE",
  "VIDEO",
] as const satisfies readonly ContentType[];

export const ARTICLE_STATUSES = [
  "DRAFT",
  "IN_REVIEW",
  "NEEDS_CORRECTION",
  "APPROVED",
  "SCHEDULED",
  "PUBLISHED",
  "UNPUBLISHED",
  "ARCHIVED",
  "REJECTED",
] as const satisfies readonly ArticleStatus[];

export const FACT_CHECK_STATUSES = [
  "UNCHECKED",
  "PARTIALLY_VERIFIED",
  "VERIFIED",
  "DISPUTED",
] as const satisfies readonly FactCheckStatus[];

export const ARTICLE_SOURCE_STATUSES = [
  "MISSING",
  "ADDED",
  "VERIFIED",
] as const satisfies readonly ArticleSourceStatus[];

export const SOURCE_TYPES = [
  "OFFICIAL",
  "NEWS_AGENCY",
  "MEDIA",
  "GOVERNMENT",
  "SOCIAL_MEDIA",
  "USER_SUBMITTED",
  "OTHER",
] as const satisfies readonly SourceType[];

export const CREDIBILITY_LEVELS = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "VERIFIED",
] as const satisfies readonly CredibilityLevel[];

export const MEDIA_ROLES = [
  "FEATURED",
  "GALLERY",
  "INLINE",
  "VIDEO",
  "ATTACHMENT",
  "OG_IMAGE",
] as const satisfies readonly MediaRole[];

/** Persian labels for UI display. */
export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  SHORT_NEWS: "خبر کوتاه",
  NEWS: "خبر",
  ARTICLE: "مقاله",
  ANALYSIS: "تحلیل",
  GUIDE: "راهنما",
  NOTICE: "اطلاعیه",
  VIDEO: "ویدئو",
};

export const ARTICLE_STATUS_LABELS: Record<ArticleStatus, string> = {
  DRAFT: "پیش‌نویس",
  IN_REVIEW: "در حال بررسی",
  NEEDS_CORRECTION: "نیازمند اصلاح",
  APPROVED: "تأییدشده",
  SCHEDULED: "زمان‌بندی‌شده",
  PUBLISHED: "منتشرشده",
  UNPUBLISHED: "منتشرنشده",
  ARCHIVED: "بایگانی",
  REJECTED: "ردشده",
};

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  OFFICIAL: "رسمی",
  NEWS_AGENCY: "خبرگزاری",
  MEDIA: "رسانه",
  GOVERNMENT: "دولتی",
  SOCIAL_MEDIA: "شبکه اجتماعی",
  USER_SUBMITTED: "ارسال کاربر",
  OTHER: "سایر",
};

export const CREDIBILITY_LABELS: Record<CredibilityLevel, string> = {
  LOW: "پایین",
  MEDIUM: "متوسط",
  HIGH: "بالا",
  VERIFIED: "تأییدشده",
};
