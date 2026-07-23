/**
 * Role-Based Access Control definitions.
 *
 * Permissions are fine-grained capability keys. Roles map to sets of
 * permissions. Both are seeded into the database (Permission / Role /
 * RolePermission), and authorization is always checked on the server against
 * the user's effective permissions — never in the UI alone.
 */

export const PERMISSIONS = {
  // ── Articles ──────────────────────────────────────────────
  ARTICLE_VIEW: "article.view",
  ARTICLE_CREATE: "article.create",
  ARTICLE_UPDATE_OWN: "article.update.own",
  ARTICLE_UPDATE_ANY: "article.update.any",
  ARTICLE_DELETE: "article.delete",
  ARTICLE_RESTORE: "article.restore",
  ARTICLE_PUBLISH: "article.publish",
  ARTICLE_SCHEDULE: "article.schedule",
  ARTICLE_MANAGE_SOURCES: "article.manage.sources",
  ARTICLE_MANAGE_SEO: "article.manage.seo",
  // Editorial workflow (Phase 5)
  ARTICLE_SUBMIT_REVIEW: "article.submit_review",
  ARTICLE_REQUEST_CORRECTION: "article.request_correction",
  ARTICLE_APPROVE: "article.approve",
  ARTICLE_REJECT: "article.reject",
  ARTICLE_UNPUBLISH: "article.unpublish",
  ARTICLE_ARCHIVE: "article.archive",
  ARTICLE_VIEW_REVISION: "article.view_revision",
  ARTICLE_RESTORE_REVISION: "article.restore_revision",

  // ── Categories ────────────────────────────────────────────
  CATEGORY_VIEW: "category.view",
  CATEGORY_CREATE: "category.create",
  CATEGORY_UPDATE: "category.update",
  CATEGORY_DELETE: "category.delete",
  CATEGORY_RESTORE: "category.restore",

  // ── Tags ──────────────────────────────────────────────────
  TAG_VIEW: "tag.view",
  TAG_CREATE: "tag.create",
  TAG_UPDATE: "tag.update",
  TAG_DELETE: "tag.delete",
  TAG_MERGE: "tag.merge",

  // ── Sources ───────────────────────────────────────────────
  SOURCE_VIEW: "source.view",
  SOURCE_CREATE: "source.create",
  SOURCE_UPDATE: "source.update",
  SOURCE_DELETE: "source.delete",
  SOURCE_VERIFY: "source.verify",

  // ── Media ─────────────────────────────────────────────────
  MEDIA_VIEW: "media.view",
  MEDIA_UPLOAD: "media.upload",
  MEDIA_UPDATE: "media.update",
  MEDIA_DELETE: "media.delete",
  MEDIA_RESTORE: "media.restore",
  MEDIA_REPLACE: "media.replace",

  // ── Homepage / breaking ───────────────────────────────────
  HOMEPAGE_MANAGE: "homepage.manage",
  BREAKING_MANAGE: "breaking.manage",

  // ── People ────────────────────────────────────────────────
  USER_MANAGE: "user.manage",
  ROLE_MANAGE: "role.manage",

  // ── Newsletter / forms ────────────────────────────────────
  NEWSLETTER_MANAGE: "newsletter.manage",
  CONTACT_MANAGE: "contact.manage",
  REPORT_MANAGE: "report.manage",

  // ── Advertising ───────────────────────────────────────────
  AD_MANAGE: "ad.manage",

  // ── Newsroom (Phase 10A) ──────────────────────────────────
  NEWSROOM_VIEW: "newsroom.view",
  NEWSROOM_MANAGE_SOURCES: "newsroom.manage_sources",
  NEWSROOM_RUN_COLLECTION: "newsroom.run_collection",
  NEWSROOM_REVIEW: "newsroom.review",
  NEWSROOM_REJECT: "newsroom.reject",
  NEWSROOM_CREATE_DRAFT: "newsroom.create_draft",
  NEWSROOM_REGENERATE: "newsroom.regenerate",
  NEWSROOM_MANAGE_CLUSTERS: "newsroom.manage_clusters",
  NEWSROOM_MANAGE_SCORING: "newsroom.manage_scoring",
  NEWSROOM_VIEW_COSTS: "newsroom.view_costs",
  NEWSROOM_VIEW_LOGS: "newsroom.view_logs",

  // ── System ────────────────────────────────────────────────
  SETTINGS_MANAGE: "settings.manage",
  SETTINGS_SENSITIVE: "settings.sensitive",
  ANALYTICS_VIEW: "analytics.view",
  AUDIT_VIEW: "audit.view",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  EDITOR_IN_CHIEF: "EDITOR_IN_CHIEF",
  EDITOR: "EDITOR",
  AUTHOR: "AUTHOR",
  REPORTER: "REPORTER",
  ADVERTISING_MANAGER: "ADVERTISING_MANAGER",
} as const;

export type RoleKey = (typeof ROLES)[keyof typeof ROLES];

const P = PERMISSIONS;

/** Human-readable role metadata (Persian names for the admin UI). */
export const ROLE_DEFINITIONS: Record<
  RoleKey,
  { name: string; description: string; isSystem: boolean }
> = {
  SUPER_ADMIN: {
    name: "مدیر ارشد",
    description: "دسترسی کامل به تمام بخش‌ها و تنظیمات حساس.",
    isSystem: true,
  },
  EDITOR_IN_CHIEF: {
    name: "سردبیر",
    description:
      "مدیریت مطالب، تأیید و انتشار، مدیریت نویسندگان، دسته‌بندی و صفحه خانه.",
    isSystem: true,
  },
  EDITOR: {
    name: "ویراستار",
    description: "مشاهده و ویرایش همه مطالب، ارسال برای اصلاح، تأیید اولیه.",
    isSystem: true,
  },
  AUTHOR: {
    name: "نویسنده",
    description: "ایجاد و ویرایش مطالب خود و ارسال برای بررسی.",
    isSystem: true,
  },
  REPORTER: {
    name: "خبرنگار",
    description: "ثبت خبر و بارگذاری رسانه و مشاهده مطالب خود.",
    isSystem: true,
  },
  ADVERTISING_MANAGER: {
    name: "مدیر تبلیغات",
    description: "مدیریت جایگاه‌های تبلیغاتی بدون دسترسی به تحریریه.",
    isSystem: true,
  },
};

const CONTENT_VIEW: PermissionKey[] = [
  P.ARTICLE_VIEW,
  P.CATEGORY_VIEW,
  P.TAG_VIEW,
  P.SOURCE_VIEW,
  P.MEDIA_VIEW,
];

/** The permission set granted to each role. */
export const ROLE_PERMISSIONS: Record<RoleKey, PermissionKey[]> = {
  SUPER_ADMIN: Object.values(P),
  EDITOR_IN_CHIEF: [
    ...CONTENT_VIEW,
    P.ARTICLE_CREATE,
    P.ARTICLE_UPDATE_ANY,
    P.ARTICLE_DELETE,
    P.ARTICLE_RESTORE,
    P.ARTICLE_PUBLISH,
    P.ARTICLE_SCHEDULE,
    P.ARTICLE_MANAGE_SOURCES,
    P.ARTICLE_MANAGE_SEO,
    P.ARTICLE_SUBMIT_REVIEW,
    P.ARTICLE_REQUEST_CORRECTION,
    P.ARTICLE_APPROVE,
    P.ARTICLE_REJECT,
    P.ARTICLE_UNPUBLISH,
    P.ARTICLE_ARCHIVE,
    P.ARTICLE_VIEW_REVISION,
    P.ARTICLE_RESTORE_REVISION,
    P.CATEGORY_CREATE,
    P.CATEGORY_UPDATE,
    P.CATEGORY_DELETE,
    P.CATEGORY_RESTORE,
    P.TAG_CREATE,
    P.TAG_UPDATE,
    P.TAG_DELETE,
    P.TAG_MERGE,
    P.SOURCE_CREATE,
    P.SOURCE_UPDATE,
    P.SOURCE_DELETE,
    P.SOURCE_VERIFY,
    P.MEDIA_UPLOAD,
    P.MEDIA_UPDATE,
    P.MEDIA_DELETE,
    P.MEDIA_RESTORE,
    P.MEDIA_REPLACE,
    P.HOMEPAGE_MANAGE,
    P.BREAKING_MANAGE,
    P.USER_MANAGE,
    P.NEWSLETTER_MANAGE,
    P.CONTACT_MANAGE,
    P.REPORT_MANAGE,
    P.ANALYTICS_VIEW,
    P.AUDIT_VIEW,
    // Newsroom — full editorial control (all but sensitive system settings).
    P.NEWSROOM_VIEW,
    P.NEWSROOM_MANAGE_SOURCES,
    P.NEWSROOM_RUN_COLLECTION,
    P.NEWSROOM_REVIEW,
    P.NEWSROOM_REJECT,
    P.NEWSROOM_CREATE_DRAFT,
    P.NEWSROOM_REGENERATE,
    P.NEWSROOM_MANAGE_CLUSTERS,
    P.NEWSROOM_MANAGE_SCORING,
    P.NEWSROOM_VIEW_COSTS,
    P.NEWSROOM_VIEW_LOGS,
  ],
  EDITOR: [
    ...CONTENT_VIEW,
    P.ARTICLE_CREATE,
    P.ARTICLE_UPDATE_ANY,
    P.ARTICLE_SUBMIT_REVIEW,
    P.ARTICLE_REQUEST_CORRECTION,
    P.ARTICLE_APPROVE,
    P.ARTICLE_REJECT,
    P.ARTICLE_VIEW_REVISION,
    P.ARTICLE_SCHEDULE,
    P.ARTICLE_MANAGE_SOURCES,
    P.ARTICLE_MANAGE_SEO,
    P.CATEGORY_CREATE,
    P.CATEGORY_UPDATE,
    P.TAG_CREATE,
    P.TAG_UPDATE,
    P.TAG_MERGE,
    P.SOURCE_CREATE,
    P.SOURCE_UPDATE,
    P.SOURCE_VERIFY,
    P.MEDIA_UPLOAD,
    P.MEDIA_UPDATE,
    P.MEDIA_REPLACE,
    P.ANALYTICS_VIEW,
    // Newsroom — day-to-day review and drafting.
    P.NEWSROOM_VIEW,
    P.NEWSROOM_REVIEW,
    P.NEWSROOM_CREATE_DRAFT,
    P.NEWSROOM_REJECT,
  ],
  AUTHOR: [
    P.ARTICLE_VIEW,
    P.ARTICLE_CREATE,
    P.ARTICLE_UPDATE_OWN,
    P.ARTICLE_SUBMIT_REVIEW,
    P.CATEGORY_VIEW,
    P.TAG_VIEW,
    P.SOURCE_VIEW,
    P.MEDIA_VIEW,
    P.MEDIA_UPLOAD,
    P.NEWSROOM_VIEW,
  ],
  REPORTER: [
    P.ARTICLE_VIEW,
    P.ARTICLE_CREATE,
    P.ARTICLE_UPDATE_OWN,
    P.CATEGORY_VIEW,
    P.TAG_VIEW,
    P.SOURCE_VIEW,
    P.MEDIA_VIEW,
    P.MEDIA_UPLOAD,
    P.NEWSROOM_VIEW,
  ],
  ADVERTISING_MANAGER: [P.AD_MANAGE, P.ANALYTICS_VIEW],
};

/** Persian description for each permission (used when seeding). */
const PERMISSION_DESCRIPTIONS: Record<PermissionKey, string> = {
  "article.view": "مشاهده مطالب",
  "article.create": "ایجاد مطلب",
  "article.update.own": "ویرایش مطالب خود",
  "article.update.any": "ویرایش همه مطالب",
  "article.delete": "حذف مطالب",
  "article.restore": "بازیابی مطالب",
  "article.publish": "انتشار مطالب",
  "article.schedule": "زمان‌بندی انتشار",
  "article.manage.sources": "مدیریت منابع مطلب",
  "article.manage.seo": "مدیریت سئوی مطلب",
  "article.submit_review": "ارسال برای بررسی",
  "article.request_correction": "درخواست اصلاح",
  "article.approve": "تأیید مطالب",
  "article.reject": "رد مطلب",
  "article.unpublish": "لغو انتشار",
  "article.archive": "بایگانی مطالب",
  "article.view_revision": "مشاهده نسخه‌ها",
  "article.restore_revision": "بازیابی نسخه",
  "category.view": "مشاهده دسته‌بندی",
  "category.create": "ایجاد دسته‌بندی",
  "category.update": "ویرایش دسته‌بندی",
  "category.delete": "حذف دسته‌بندی",
  "category.restore": "بازیابی دسته‌بندی",
  "tag.view": "مشاهده برچسب",
  "tag.create": "ایجاد برچسب",
  "tag.update": "ویرایش برچسب",
  "tag.delete": "حذف برچسب",
  "tag.merge": "ادغام برچسب‌ها",
  "source.view": "مشاهده منبع",
  "source.create": "ایجاد منبع",
  "source.update": "ویرایش منبع",
  "source.delete": "حذف منبع",
  "source.verify": "تأیید منبع",
  "media.view": "مشاهده رسانه",
  "media.upload": "بارگذاری رسانه",
  "media.update": "ویرایش رسانه",
  "media.delete": "حذف رسانه",
  "media.restore": "بازیابی رسانه",
  "media.replace": "جایگزینی رسانه",
  "homepage.manage": "مدیریت صفحه خانه",
  "breaking.manage": "مدیریت خبر فوری",
  "user.manage": "مدیریت کاربران",
  "role.manage": "مدیریت نقش‌ها",
  "newsletter.manage": "مدیریت خبرنامه",
  "contact.manage": "مدیریت پیام‌های تماس",
  "report.manage": "مدیریت گزارش‌های خطا",
  "ad.manage": "مدیریت تبلیغات",
  "settings.manage": "مدیریت تنظیمات",
  "settings.sensitive": "دسترسی به تنظیمات حساس",
  "analytics.view": "مشاهده آمار",
  "audit.view": "مشاهده Audit Log",
  "newsroom.view": "مشاهده اتاق خبر",
  "newsroom.manage_sources": "مدیریت منابع اتاق خبر",
  "newsroom.run_collection": "اجرای جمع‌آوری اخبار",
  "newsroom.review": "بررسی صف اتاق خبر",
  "newsroom.reject": "رد آیتم اتاق خبر",
  "newsroom.create_draft": "ساخت پیش‌نویس از خبر",
  "newsroom.regenerate": "بازتولید پیش‌نویس",
  "newsroom.manage_clusters": "مدیریت خوشه‌های خبری",
  "newsroom.manage_scoring": "مدیریت وزن‌های امتیازدهی",
  "newsroom.view_costs": "مشاهده هزینه‌های هوش مصنوعی",
  "newsroom.view_logs": "مشاهده لاگ‌های اتاق خبر",
};

/** All permission keys with an optional description for seeding. */
export const PERMISSION_LIST: { key: PermissionKey; description: string }[] =
  Object.values(PERMISSIONS).map((key) => ({
    key,
    description: PERMISSION_DESCRIPTIONS[key],
  }));
