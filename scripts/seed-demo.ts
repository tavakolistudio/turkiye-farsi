/**
 * Demo content seed — fills the public homepage with realistic Persian news so
 * the Monocle broadsheet layout renders like the reference (photos + headlines
 * across the grid). Idempotent: upserts by slug/id, safe to re-run.
 *
 * It also HIDES (reversibly — never hard-deletes) leftover test junk:
 * junk categories → isActive=false, junk articles → status=UNPUBLISHED.
 *
 * Run:  npx tsx scripts/seed-demo.ts
 * Undo demo:  npx tsx scripts/seed-demo.ts --remove
 */
import { PrismaClient, type Prisma } from "@prisma/client";

const prisma = new PrismaClient();
const REMOVE = process.argv.includes("--remove");

const RAILS = [
  { slug: "اخبار-ترکیه", name: "اخبار ترکیه", order: 1 },
  { slug: "اقامت-ترکیه", name: "اقامت ترکیه", order: 2 },
  { slug: "قوانین-جدید-ترکیه", name: "قوانین جدید", order: 3 },
  { slug: "اقتصاد-ترکیه", name: "اقتصاد ترکیه", order: 4 },
  { slug: "استانبول", name: "استانبول", order: 5 },
  { slug: "یالووا", name: "یالووا", order: 6 },
];

type Demo = {
  slug: string;
  title: string;
  summary: string;
  cat: string;
  type?: "NEWS" | "GUIDE" | "VIDEO" | "ANALYSIS";
  hero?: boolean;
  featured?: boolean;
  breaking?: boolean;
  pick?: boolean;
  views: number;
  read: number;
  impact?: { why: string; who: string; todo: string };
};

const ARTICLES: Demo[] = [
  {
    slug: "demo-lira-record-low",
    title: "لیر ترکیه به پایین‌ترین سطح چند ماه اخیر رسید",
    summary:
      "کاهش تازه ارزش لیر در برابر دلار، هزینه زندگی ایرانیان مقیم ترکیه و بازار اجاره مسکن را زیر فشار برد.",
    cat: "اقتصاد-ترکیه",
    hero: true,
    featured: true,
    views: 5200,
    read: 6,
    impact: {
      why: "افت لیر مستقیماً روی اجاره‌بها، شهریه و هزینه تمدید اقامت اثر می‌گذارد.",
      who: "ایرانیانی که درآمد ریالی/دلاری دارند و در ترکیه زندگی یا سرمایه‌گذاری می‌کنند.",
      todo: "قراردادهای اجاره را پیش از تمدید بازبینی کنید و نرخ روز صرافی‌های رسمی را پیگیری کنید.",
    },
  },
  { slug: "demo-ikamet-renewal-rule", title: "تصمیم تازه اداره مهاجرت درباره تمدید اقامت توریستی", summary: "اداره مهاجرت شرایط جدیدی برای تمدید اقامت کوتاه‌مدت اعلام کرد که از ماه آینده اجرایی می‌شود.", cat: "قوانین-جدید-ترکیه", breaking: true, views: 3100, read: 4 },
  { slug: "demo-istanbul-snow-schools", title: "بارش سنگین برف مدارس استانبول را تعطیل کرد", summary: "شهرداری استانبول به‌دلیل کولاک و یخبندان، آموزش حضوری را برای یک روز تعطیل اعلام کرد.", cat: "استانبول", breaking: true, views: 2600, read: 3 },
  { slug: "demo-istanbul-transit-fare", title: "افزایش کرایه حمل‌ونقل عمومی استانبول از هفته آینده", summary: "نرخ جدید استانبول‌کارت برای مترو، اتوبوس و مترو‌بوس تصویب شد.", cat: "استانبول", breaking: true, views: 1900, read: 3 },
  { slug: "demo-bank-account-guide", title: "راهنمای کامل افتتاح حساب بانکی برای اتباع خارجی", summary: "از مدارک لازم تا انتخاب بانک مناسب؛ هر آنچه برای باز کردن حساب در ترکیه باید بدانید.", cat: "اقامت-ترکیه", type: "GUIDE", pick: true, views: 4100, read: 7 },
  { slug: "demo-inflation-analysis", title: "تحلیل: چرا تورم ترکیه دوباره شتاب گرفت؟", summary: "نگاهی به ریشه‌های موج تازه تورم و پیامد آن برای خانوارهای مهاجر.", cat: "اقتصاد-ترکیه", type: "ANALYSIS", pick: true, views: 2200, read: 8 },
  { slug: "demo-ikamet-steps-2026", title: "مراحل گرفتن نوبت اقامت (ایکامت) در سال ۲۰۲۶", summary: "گام‌به‌گام تا ثبت درخواست اقامت: نوبت‌گیری، مدارک و نکات مهم.", cat: "قوانین-جدید-ترکیه", type: "GUIDE", views: 3600, read: 6 },
  { slug: "demo-yalova-rent-guide", title: "چطور در یالووا خانه اجاره کنیم؟ راهنمای گام‌به‌گام", summary: "بازار اجاره یالووا، محله‌های مناسب ایرانیان و نکات قرارداد.", cat: "یالووا", type: "GUIDE", views: 1500, read: 5 },
  { slug: "demo-grand-bazaar-video", title: "ویدئو: گشت‌وگذار در بازار بزرگ استانبول", summary: "قدم‌زدن در دالان‌های تاریخی گرند بازار و راهنمای خرید مطمئن.", cat: "استانبول", type: "VIDEO", views: 2800, read: 2 },
  { slug: "demo-yalova-thermal-video", title: "ویدئو: چشمه‌های آب‌گرم ترمال یالووا", summary: "معرفی مقصدهای آب‌گرم یالووا برای یک سفر آخر هفته.", cat: "یالووا", type: "VIDEO", views: 1200, read: 2 },
  { slug: "demo-iran-turkey-tourism", title: "توافق تازه گردشگری میان ایران و ترکیه امضا شد", summary: "دو کشور بر تسهیل سفر و همکاری‌های گردشگری تازه توافق کردند.", cat: "اخبار-ترکیه", views: 3300, read: 4 },
  { slug: "demo-border-exit-fee", title: "نرخ جدید عوارض خروج از مرزهای ترکیه اعلام شد", summary: "میزان عوارض خروج برای سال جاری بازنگری و منتشر شد.", cat: "اخبار-ترکیه", views: 2400, read: 3 },
  { slug: "demo-istanbul-metro-line", title: "طرح توسعه خط متروی جدید استانبول کلید خورد", summary: "خط تازه، مناطق پرتردد اروپایی شهر را به هم متصل می‌کند.", cat: "استانبول", views: 1700, read: 3 },
  { slug: "demo-yalova-property-invest", title: "رشد سرمایه‌گذاری ایرانیان در املاک یالووا", summary: "یالووا به یکی از مقصدهای محبوب خرید ملک ایرانیان تبدیل شده است.", cat: "یالووا", views: 2100, read: 5 },
  { slug: "demo-tenant-support", title: "بسته حمایتی تازه دولت ترکیه برای مستأجران", summary: "دولت سقف افزایش اجاره‌بها و مشوق‌های تازه‌ای اعلام کرد.", cat: "اقتصاد-ترکیه", views: 1600, read: 4 },
  { slug: "demo-family-residence-docs", title: "مدارک لازم برای تمدید اقامت خانوادگی", summary: "فهرست کامل مدارک و نکات کلیدی برای تمدید اقامت خانواده.", cat: "اقامت-ترکیه", views: 1400, read: 5 },
];

function body(summary: string): Prisma.InputJsonValue {
  return {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: summary }] },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "این یک خبر نمونه است که برای نمایش چیدمان صفحه ساخته شده است. متن کامل خبر واقعی از پنل مدیریت جایگزین می‌شود.",
          },
        ],
      },
    ],
  };
}

async function removeDemo() {
  const del = await prisma.article.deleteMany({ where: { slug: { startsWith: "demo-" } } });
  console.log(`Removed ${del.count} demo articles.`);
  process.exit(0);
}

async function main() {
  if (REMOVE) return removeDemo();

  const author = await prisma.user.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!author) throw new Error("No user found to author demo articles.");

  // 1) Rail categories (upsert by slug).
  const catBySlug = new Map<string, string>();
  for (const c of RAILS) {
    const cat = await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, order: c.order, isActive: true, deletedAt: null },
      create: { name: c.name, slug: c.slug, order: c.order, isActive: true },
      select: { id: true },
    });
    catBySlug.set(c.slug, cat.id);
  }
  console.log(`Categories ready: ${catBySlug.size}`);

  // 2) Demo articles with picsum photos (reliable, CSP allows https:).
  const now = Date.now();
  let i = 0;
  for (const a of ARTICLES) {
    const publishedAt = new Date(now - i * 3 * 3600 * 1000); // stagger 3h apart
    const img = `https://picsum.photos/seed/${a.slug}/1200/800`;
    const media = await prisma.media.upsert({
      where: { id: `media-${a.slug}` },
      update: { publicUrl: img, alt: a.title },
      create: {
        id: `media-${a.slug}`,
        filename: `${a.slug}.jpg`,
        originalFilename: `${a.slug}.jpg`,
        storagePath: `demo/${a.slug}.jpg`,
        publicUrl: img,
        mimeType: "image/jpeg",
        size: 200000,
        width: 1200,
        height: 800,
        alt: a.title,
        uploadedById: author.id,
      },
      select: { id: true },
    });

    const catId = catBySlug.get(a.cat)!;
    const data = {
      title: a.title,
      summary: a.summary,
      subtitle: null as string | null,
      bodyJson: body(a.summary),
      contentType: (a.type ?? "NEWS") as Prisma.ArticleCreateInput["contentType"],
      status: "PUBLISHED" as Prisma.ArticleCreateInput["status"],
      currentVersion: 1,
      authorId: author.id,
      primaryCategoryId: catId,
      featuredImageId: media.id,
      readingTime: a.read,
      viewCount: a.views,
      isHero: !!a.hero,
      isFeatured: !!a.featured,
      isBreaking: !!a.breaking,
      isEditorsPick: !!a.pick,
      whyItMatters: a.impact?.why ?? null,
      whoIsAffected: a.impact?.who ?? null,
      whatToDo: a.impact?.todo ?? null,
      metaDescription: a.summary,
      publishedAt,
    };

    const article = await prisma.article.upsert({
      where: { slug: a.slug },
      update: data,
      create: { slug: a.slug, ...data },
      select: { id: true },
    });

    // taxonomy join (for category pages)
    await prisma.articleCategory.upsert({
      where: { articleId_categoryId: { articleId: article.id, categoryId: catId } },
      update: { isPrimary: true },
      create: { articleId: article.id, categoryId: catId, isPrimary: true },
    });
    i++;
  }
  console.log(`Demo articles upserted: ${ARTICLES.length}`);

  // 3) Hide leftover test junk (reversible).
  const railSlugs = new Set(RAILS.map((r) => r.slug));
  const cats = await prisma.category.findMany({ select: { id: true, slug: true, name: true, isActive: true } });
  const junkCatIds = cats
    .filter((c) => !railSlugs.has(c.slug) && !c.slug.startsWith("demo-"))
    .filter((c) => /[0-9]{5,}/.test(c.slug) || /[0-9]{5,}/.test(c.name) || /^(pub|itc|tc|cat)[-\s]/i.test(c.slug) || /(^|\s)(pub|itc|cat|والد|دسته pub)/i.test(c.name))
    .map((c) => c.id);
  if (junkCatIds.length) {
    const r = await prisma.category.updateMany({ where: { id: { in: junkCatIds } }, data: { isActive: false } });
    console.log(`Deactivated ${r.count} junk categories.`);
  }

  const arts = await prisma.article.findMany({ where: { status: "PUBLISHED" }, select: { id: true, slug: true, title: true } });
  const junkArtIds = arts
    .filter((a) => !a.slug.startsWith("demo-"))
    .filter((a) => /[0-9]{6,}/.test(a.slug) || /[0-9]{6,}/.test(a.title) || /^seo-/i.test(a.slug))
    .map((a) => a.id);
  if (junkArtIds.length) {
    const r = await prisma.article.updateMany({ where: { id: { in: junkArtIds } }, data: { status: "UNPUBLISHED" } });
    console.log(`Unpublished ${r.count} junk articles.`);
  }

  console.log("Done.");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
