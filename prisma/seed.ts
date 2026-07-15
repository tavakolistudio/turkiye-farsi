/**
 * Database seed. Idempotent (safe to re-run) via upserts on natural keys.
 *
 *   npm run db:seed
 *
 * Super-admin credentials come from env (INITIAL_ADMIN_*), never hardcoded.
 */
import { PrismaClient, Prisma, HomeSectionType } from "@prisma/client";
import {
  PERMISSION_LIST,
  ROLE_DEFINITIONS,
  ROLE_PERMISSIONS,
  ROLES,
  type RoleKey,
} from "../src/server/rbac/permissions";
import { hashPassword } from "../src/server/auth/password";
import { slugify } from "../src/lib/slug";
import { readingMinutes } from "../src/lib/reading-time";

const prisma = new PrismaClient();

/** Build a minimal TipTap document from paragraphs. */
function doc(paragraphs: string[]) {
  return {
    type: "doc",
    content: paragraphs.map((p) => ({
      type: "paragraph",
      content: [{ type: "text", text: p }],
    })),
  };
}

const CATEGORIES = [
  "اخبار ترکیه",
  "اخبار ایران",
  "روابط ایران و ترکیه",
  "اقامت ترکیه",
  "مهاجرت",
  "شهروندی ترکیه",
  "قوانین جدید ترکیه",
  "اقتصاد ترکیه",
  "نرخ ارز",
  "املاک ترکیه",
  "خودرو",
  "مالیات",
  "بانکداری",
  "آموزش",
  "مدارس",
  "سلامت",
  "گردشگری ترکیه",
  "پرواز و خطوط هوایی",
  "ویزا و کنسولی",
  "تکنولوژی",
  "هوش مصنوعی",
  "استانبول",
  "یالووا",
  "آنکارا",
  "ازمیر",
  "آنتالیا",
  "بورسا",
  "اخبار بین‌الملل",
  "جامعه ایرانیان ترکیه",
];

const TAGS = [
  "اقامت",
  "کیملیک",
  "قیمت دلار",
  "قیمت لیر",
  "اجازه اقامت",
  "پاسپورت",
  "استانبول",
  "خرید ملک",
  "ویزا",
  "بیمه",
];

async function seedPermissionsAndRoles() {
  for (const p of PERMISSION_LIST) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: { description: p.description },
      create: { key: p.key, description: p.description },
    });
  }

  for (const roleKey of Object.keys(ROLE_DEFINITIONS) as RoleKey[]) {
    const def = ROLE_DEFINITIONS[roleKey];
    const role = await prisma.role.upsert({
      where: { key: roleKey },
      update: { name: def.name, description: def.description, isSystem: def.isSystem },
      create: { key: roleKey, name: def.name, description: def.description, isSystem: def.isSystem },
    });

    // Reset and reassign this role's permissions.
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    const perms = await prisma.permission.findMany({
      where: { key: { in: ROLE_PERMISSIONS[roleKey] } },
    });
    await prisma.rolePermission.createMany({
      data: perms.map((perm) => ({ roleId: role.id, permissionId: perm.id })),
      skipDuplicates: true,
    });
  }
}

async function seedUser(opts: {
  email: string;
  name: string;
  password: string;
  roleKey: RoleKey;
  profile?: { bio?: string; expertise?: string };
}) {
  const passwordHash = await hashPassword(opts.password);
  const user = await prisma.user.upsert({
    where: { email: opts.email },
    update: { name: opts.name },
    create: { email: opts.email, name: opts.name, passwordHash },
  });

  // Profile slug comes from the display name, but Profile.slug is globally
  // unique — two different users with the same name (e.g. an old and a new
  // admin both named "مدیر ارشد") would collide. Fall back to a suffixed slug.
  let slug = slugify(opts.name) || user.id;
  const slugOwner = await prisma.profile.findUnique({ where: { slug } });
  if (slugOwner && slugOwner.userId !== user.id) {
    slug = `${slug}-${user.id.slice(-6)}`;
  }
  await prisma.profile.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      displayName: opts.name,
      slug,
      bio: opts.profile?.bio,
      expertise: opts.profile?.expertise,
    },
  });

  const role = await prisma.role.findUnique({ where: { key: opts.roleKey } });
  if (role) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      update: {},
      create: { userId: user.id, roleId: role.id },
    });
  }
  return user;
}

async function seedCategories() {
  const ids: Record<string, string> = {};
  let order = 0;
  for (const name of CATEGORIES) {
    const slug = slugify(name);
    const cat = await prisma.category.upsert({
      where: { slug },
      update: { name, order },
      create: {
        name,
        slug,
        order,
        metaTitle: name,
        metaDescription: `آخرین اخبار و مطالب مرتبط با ${name} در ترکیه فارسی.`,
      },
    });
    ids[name] = cat.id;
    order += 1;
  }
  return ids;
}

async function seedTags() {
  const ids: Record<string, string> = {};
  for (const name of TAGS) {
    const slug = slugify(name);
    const tag = await prisma.tag.upsert({
      where: { slug },
      update: { name },
      create: { name, slug },
    });
    ids[name] = tag.id;
  }
  return ids;
}

/**
 * DEV-ONLY sample content (sample articles, sources, ad, breaking news).
 * Never runs in production so no demo data ships to real deployments.
 */
async function seedSampleContent(
  cat: Record<string, string>,
  tag: Record<string, string>,
  editorId: string,
  authorId: string,
) {
  console.log("→ Seeding sample sources (dev only) ...");
  const sourceData = [
    { name: "اداره مهاجرت ترکیه", slug: "goc", websiteUrl: "https://www.goc.gov.tr", sourceType: "GOVERNMENT", credibilityLevel: "VERIFIED", isOfficial: true },
    { name: "بانک مرکزی ترکیه", slug: "tcmb", websiteUrl: "https://www.tcmb.gov.tr", sourceType: "OFFICIAL", credibilityLevel: "VERIFIED", isOfficial: true },
    { name: "شهرداری استانبول", slug: "ibb", websiteUrl: "https://www.ibb.istanbul", sourceType: "GOVERNMENT", credibilityLevel: "HIGH", isOfficial: true },
    { name: "خبرگزاری آناتولی", slug: "anadolu", websiteUrl: "https://www.aa.com.tr", sourceType: "NEWS_AGENCY", credibilityLevel: "HIGH", isOfficial: false },
  ] as const;
  const src: Record<string, string> = {};
  for (const s of sourceData) {
    const row = await prisma.source.upsert({
      where: { slug: s.slug },
      update: {},
      create: {
        name: s.name,
        slug: s.slug,
        websiteUrl: s.websiteUrl,
        sourceType: s.sourceType,
        credibilityLevel: s.credibilityLevel,
        isOfficial: s.isOfficial,
        country: "ترکیه",
        language: "tr",
      },
    });
    src[s.slug] = row.id;
  }

  console.log("→ Seeding sample media metadata (dev only) ...");
  const mediaData = [
    { originalFilename: "residency-cover.jpg", storagePath: "uploads/sample/residency-cover.jpg", alt: "اقامت ترکیه" },
    { originalFilename: "lira-cover.jpg", storagePath: "uploads/sample/lira-cover.jpg", alt: "نرخ لیر" },
  ];
  const media: string[] = [];
  for (const m of mediaData) {
    let row = await prisma.media.findFirst({ where: { storagePath: m.storagePath } });
    if (!row) {
      row = await prisma.media.create({
        data: {
          filename: m.storagePath.split("/").pop()!,
          originalFilename: m.originalFilename,
          storagePath: m.storagePath,
          publicUrl: `/${m.storagePath}`,
          mimeType: "image/jpeg",
          size: 120_000,
          width: 1200,
          height: 675,
          alt: m.alt,
          uploadedById: editorId,
        },
      });
    }
    media.push(row.id);
  }

  console.log("→ Seeding sample articles (dev only) ...");
  const sampleArticles = [
    {
      title: "تغییرات جدید در قوانین اجازه اقامت کوتاه‌مدت ترکیه اعلام شد",
      subtitle: "متقاضیان اقامت باید به شرایط جدید بیمه و اثبات مالی توجه کنند",
      summary:
        "اداره مهاجرت ترکیه شرایط تازه‌ای برای صدور و تمدید اجازه اقامت کوتاه‌مدت اعلام کرده که از ماه آینده اجرایی می‌شود.",
      body: [
        "اداره مهاجرت ترکیه در اطلاعیه‌ای رسمی از تغییر شرایط صدور اجازه اقامت کوتاه‌مدت خبر داد.",
        "بر اساس این تغییرات، ارائه بیمه درمانی معتبر و اثبات تمکن مالی برای همه متقاضیان الزامی خواهد بود.",
      ],
      category: "اقامت ترکیه",
      tags: ["اقامت", "اجازه اقامت", "بیمه"],
      contentType: "NEWS" as const,
      isBreaking: true,
      isHero: true,
      isEditorsPick: true,
      featuredImageId: media[0],
      authorId,
      sourceSlug: "goc",
      sourceTitle: "اطلاعیه رسمی اداره مهاجرت",
    },
    {
      title: "نرخ لیر ترکیه در برابر دلار در هفته گذشته چگونه تغییر کرد؟",
      subtitle: "مروری بر روند بازار ارز و تأثیر آن بر زندگی ایرانیان",
      summary:
        "در این گزارش روند تغییرات نرخ لیر و دلار در هفته گذشته و پیامدهای آن برای ساکنان ایرانی بررسی می‌شود.",
      body: [
        "بازار ارز ترکیه هفته پرنوسانی را پشت سر گذاشت.",
        "نوسانات نرخ لیر تأثیر مستقیمی بر هزینه‌های زندگی و اجاره مسکن دارد.",
      ],
      category: "نرخ ارز",
      tags: ["قیمت لیر", "قیمت دلار"],
      contentType: "ANALYSIS" as const,
      isEditorsPick: true,
      featuredImageId: media[1],
      authorId: editorId,
      sourceSlug: "tcmb",
      sourceTitle: "آمار بانک مرکزی ترکیه",
    },
    {
      title: "راهنمای کامل افتتاح حساب بانکی در ترکیه برای اتباع خارجی",
      subtitle: "مدارک لازم، مراحل و نکات مهم",
      summary: "برای افتتاح حساب بانکی در ترکیه به چه مدارکی نیاز دارید و مراحل آن چگونه است؟",
      body: [
        "افتتاح حساب بانکی یکی از نخستین کارهای ضروری پس از ورود به ترکیه است.",
        "داشتن شماره مالیاتی و آدرس معتبر از پیش‌نیازهای اصلی محسوب می‌شود.",
      ],
      category: "بانکداری",
      tags: ["بیمه", "کیملیک"],
      contentType: "GUIDE" as const,
      authorId,
      sourceSlug: "anadolu",
      sourceTitle: "گزارش خبرگزاری آناتولی",
    },
    {
      title: "پروژه‌های عمرانی تازه در استانبول؛ چه مناطقی متحول می‌شوند؟",
      subtitle: "نگاهی به طرح‌های توسعه شهری کلان‌شهر استانبول",
      summary: "شهرداری استانبول از آغاز چند پروژه عمرانی بزرگ خبر داده که بر بازار مسکن اثرگذار است.",
      body: [
        "استانبول همچنان قطب اصلی سرمایه‌گذاری و مهاجرت در ترکیه است.",
        "پروژه‌های تازه می‌توانند قیمت مسکن در مناطق مختلف را تغییر دهند.",
      ],
      category: "استانبول",
      tags: ["استانبول", "خرید ملک"],
      contentType: "NEWS" as const,
      authorId: editorId,
      sourceSlug: "ibb",
      sourceTitle: "اعلام شهرداری استانبول",
    },
  ];

  for (const a of sampleArticles) {
    const slug = slugify(a.title);
    const content = doc(a.body);
    const article = await prisma.article.upsert({
      where: { slug },
      update: {},
      create: {
        title: a.title,
        slug,
        subtitle: a.subtitle,
        summary: a.summary,
        bodyJson: content,
        contentType: a.contentType,
        status: "PUBLISHED",
        isBreaking: a.isBreaking ?? false,
        isHero: a.isHero ?? false,
        isEditorsPick: a.isEditorsPick ?? false,
        readingTime: readingMinutes(content),
        viewCount: Math.floor(Math.random() * 500) + 50,
        metaTitle: a.title,
        metaDescription: a.summary,
        sourceStatus: "ADDED",
        factCheckStatus: "PARTIALLY_VERIFIED",
        publishedAt: new Date(),
        author: { connect: { id: a.authorId } },
        primaryCategory: { connect: { id: cat[a.category] } },
        ...(a.featuredImageId ? { featuredImage: { connect: { id: a.featuredImageId } } } : {}),
        whyItMatters:
          "این خبر می‌تواند بر تصمیم‌های اقامتی و مالی ایرانیان ساکن ترکیه اثر بگذارد.",
        categories: { create: [{ category: { connect: { id: cat[a.category] } }, isPrimary: true, order: 0 }] },
        tags: {
          create: a.tags.filter((t) => tag[t]).map((t) => ({ tag: { connect: { id: tag[t] } } })),
        },
      },
    });

    const existingSource = await prisma.articleSource.findFirst({ where: { articleId: article.id } });
    if (!existingSource && src[a.sourceSlug]) {
      await prisma.articleSource.create({
        data: {
          article: { connect: { id: article.id } },
          source: { connect: { id: src[a.sourceSlug] } },
          sourceTitle: a.sourceTitle,
          isPrimary: true,
          accessedAt: new Date(),
        },
      });
    }
  }

  console.log("→ Seeding sample advertisement & breaking news (dev only) ...");
  if ((await prisma.advertisement.count()) === 0) {
    await prisma.advertisement.create({
      data: {
        name: "بنر نمونه صفحه خانه",
        placement: "HOMEPAGE",
        status: "ACTIVE",
        linkUrl: "https://example.com",
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
  }
  if ((await prisma.breakingNews.count()) === 0) {
    await prisma.breakingNews.create({
      data: {
        title: "شرایط جدید اجازه اقامت کوتاه‌مدت ترکیه از ماه آینده اجرایی می‌شود",
        priority: 10,
        isActive: true,
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
  }
}

async function main() {
  console.log("→ Seeding permissions and roles ...");
  await seedPermissionsAndRoles();

  console.log("→ Seeding super admin (from env, no hardcoded credentials) ...");
  const adminEmail = process.env.INITIAL_ADMIN_EMAIL;
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;
  const adminName = process.env.INITIAL_ADMIN_NAME || "مدیر ارشد";
  if (!adminEmail || !adminPassword) {
    throw new Error(
      "Seed متوقف شد: متغیرهای محیطی INITIAL_ADMIN_EMAIL و INITIAL_ADMIN_PASSWORD الزامی هستند و هیچ مقدار پیش‌فرضی در کد وجود ندارد.",
    );
  }
  const admin = await seedUser({
    email: adminEmail,
    name: adminName,
    password: adminPassword,
    roleKey: ROLES.SUPER_ADMIN,
    profile: { bio: "مدیر ارشد ترکیه فارسی", expertise: "مدیریت تحریریه" },
  });

  console.log("→ Seeding categories ...");
  const cat = await seedCategories();

  // Sample content is DEV-ONLY so a production seed never ships default
  // credentials or demo data. Force it on with SEED_SAMPLE_DATA=true.
  const seedSamples =
    process.env.NODE_ENV !== "production" ||
    process.env.SEED_SAMPLE_DATA === "true";

  if (seedSamples) {
    console.log("→ Seeding sample users & tags (dev only) ...");
    const editor = await seedUser({
      email: "editor@turkiyefarsi.local",
      name: "سردبیر نمونه",
      password: "Editor!2026",
      roleKey: ROLES.EDITOR_IN_CHIEF,
      profile: { bio: "سردبیر بخش خبری", expertise: "اخبار ترکیه و اقتصاد" },
    });
    const author = await seedUser({
      email: "author@turkiyefarsi.local",
      name: "نویسنده نمونه",
      password: "Author!2026",
      roleKey: ROLES.AUTHOR,
      profile: { bio: "نویسنده حوزه اقامت و مهاجرت", expertise: "اقامت و مهاجرت" },
    });
    const tag = await seedTags();
    await seedSampleContent(cat, tag, editor.id, author.id);
  } else {
    console.log("→ Production mode: skipping sample users, articles and demo ads.");
  }

  console.log("→ Seeding home sections ...");
  const homeSections: {
    type: HomeSectionType;
    title: string;
    order: number;
    itemCount: number;
    categoryId?: string;
  }[] = [
    { type: "HERO", title: "تیتر اصلی", order: 0, itemCount: 5 },
    { type: "BREAKING", title: "اخبار فوری", order: 1, itemCount: 5 },
    { type: "LATEST", title: "آخرین اخبار", order: 2, itemCount: 8 },
    { type: "TODAY_IMPORTANT", title: "مهم‌ترین اخبار امروز", order: 3, itemCount: 6 },
    { type: "RESIDENCY_MIGRATION", title: "اقامت و مهاجرت", order: 4, itemCount: 6, categoryId: cat["اقامت ترکیه"] },
    { type: "NEW_LAWS", title: "قوانین جدید", order: 5, itemCount: 6, categoryId: cat["قوانین جدید ترکیه"] },
    { type: "ECONOMY", title: "اقتصاد و نرخ ارز", order: 6, itemCount: 6, categoryId: cat["اقتصاد ترکیه"] },
    { type: "CITY", title: "استانبول", order: 7, itemCount: 6, categoryId: cat["استانبول"] },
    { type: "MOST_VIEWED", title: "پربازدیدترین مطالب", order: 8, itemCount: 6 },
    { type: "EDITOR_PICKS", title: "منتخب سردبیر", order: 9, itemCount: 4 },
    { type: "NEWSLETTER", title: "عضویت در خبرنامه", order: 10, itemCount: 0 },
    { type: "ADVERTISEMENT", title: "تبلیغات", order: 11, itemCount: 0 },
  ];
  for (const s of homeSections) {
    const existing = await prisma.homeSection.findFirst({ where: { type: s.type } });
    if (existing) {
      await prisma.homeSection.update({
        where: { id: existing.id },
        data: { title: s.title, order: s.order, itemCount: s.itemCount, categoryId: s.categoryId },
      });
    } else {
      await prisma.homeSection.create({
        data: { type: s.type, title: s.title, order: s.order, itemCount: s.itemCount, categoryId: s.categoryId },
      });
    }
  }

  console.log("→ Seeding site settings ...");
  const settings: Record<string, Prisma.InputJsonValue> = {
    general: {
      siteName: "ترکیه فارسی",
      description:
        "رسانه خبری و آموزشی فارسی‌زبان برای ایرانیان ساکن ترکیه.",
      email: "info@turkiyefarsi.example",
      phone: "",
      address: "",
      socials: { telegram: "", instagram: "", x: "", whatsapp: "" },
    },
    footer: {
      about:
        "ترکیه فارسی، مرجع اخبار و راهنمای زندگی برای فارسی‌زبانان ساکن ترکیه.",
      copyright: "© ترکیه فارسی — همه حقوق محفوظ است.",
    },
    seo: {
      siteTitle: "ترکیه فارسی",
      siteDescription:
        "اخبار ترکیه، اقامت، قوانین، اقتصاد و راهنمای زندگی برای ایرانیان.",
      googleVerification: "",
    },
    maintenance: { enabled: false, title: "", message: "" },
    "page:about": {
      title: "درباره ترکیه فارسی",
      summary: "رسانه‌ای فارسی‌زبان برای پوشش خبرها و اطلاعات کاربردی زندگی در ترکیه.",
      body: "ترکیه فارسی با تمرکز بر دقت، شفافیت منابع و نیازهای واقعی فارسی‌زبانان، خبرها و راهنماهای مرتبط با ترکیه را منتشر می‌کند.\n\nمطالب تحریریه بر پایه منابع مشخص تهیه می‌شوند و اصلاحیه‌های منتشرشده در همان صفحه خبر در دسترس هستند.",
    },
    "page:contact": {
      title: "تماس با ما",
      summary: "راه‌های تماس معتبر از تنظیمات سایت نمایش داده می‌شوند.",
      body: "برای ارتباط با تحریریه، گزارش خطا یا پیشنهاد سوژه از اطلاعات تماس ثبت‌شده در تنظیمات رسمی سایت استفاده کنید. اطلاعات تماس ساختگی در این صفحه نمایش داده نمی‌شود.",
    },
    "page:advertising": {
      title: "تبلیغات",
      body: "درخواست‌های تبلیغاتی پس از بررسی تناسب با مخاطبان و سیاست استقلال تحریریه پذیرفته می‌شوند. انتشار تبلیغ به معنای تأیید تحریریه نیست و محتوای تبلیغاتی به‌روشنی مشخص خواهد شد.",
    },
    "page:cooperation": {
      title: "همکاری با ما",
      body: "ترکیه فارسی از پیشنهاد همکاری نویسندگان، خبرنگاران، مترجمان و متخصصان حوزه‌های مرتبط استقبال می‌کند. اطلاعات تماس و مسیر ارسال درخواست از تنظیمات رسمی سایت اعلام می‌شود.",
    },
    "page:privacy": {
      title: "حریم خصوصی",
      body: "ترکیه فارسی فقط داده‌های ضروری برای ارائه و بهبود خدمات را پردازش می‌کند. شمارش بازدید با شناسه چرخشی و بدون ذخیره اطلاعات شخصی غیرضروری انجام می‌شود.\n\nاطلاعات کاربران برای مقاصد نامرتبط فروخته نمی‌شود و دسترسی مدیریتی به داده‌ها محدود است.",
    },
    "page:terms": {
      title: "شرایط استفاده",
      body: "استفاده از محتوای سایت باید با رعایت حقوق نشر، ذکر منبع و قوانین قابل اجرا انجام شود. کاربران نباید از خدمات برای فعالیت غیرقانونی، ایجاد اختلال یا تلاش برای دسترسی غیرمجاز استفاده کنند.",
    },
    "page:corrections-policy": {
      title: "سیاست اصلاحیه",
      body: "اگر خطای معناداری در یک مطلب تأیید شود، اصلاحیه‌ای مستقل از تاریخچه ویرایش در همان صفحه خبر منتشر می‌شود. اصلاحیه شامل شرح تغییر و زمان انتشار است و ترتیب آن حفظ می‌شود.\n\nگزارش‌های خطا بررسی می‌شوند و تغییرات پنهان جایگزین اطلاع‌رسانی شفاف نخواهند شد.",
    },
  };
  for (const [key, value] of Object.entries(settings)) {
    await prisma.siteSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  await prisma.auditLog.create({
    data: { userId: admin.id, action: "seed.run", entityType: "system" },
  });

  console.log("\n✓ Seed complete.");
  console.log("  Super admin: created/updated from INITIAL_ADMIN_EMAIL (not logged).");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
