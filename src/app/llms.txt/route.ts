import { siteConfig } from "@/lib/site-config";
import { siteOrigin } from "@/lib/seo/urls";
import { publicSiteService } from "@/server/services/public-site.service";
import { STATIC_PAGES } from "@/lib/public-links";

/**
 * llms.txt — the emerging convention for telling AI assistants what a site is
 * and where its canonical content lives (see llmstxt.org). Mirrors robots.txt
 * in spirit: a concise, machine-readable map of the *public* surface only.
 * Regenerated hourly so new sections appear without a redeploy.
 */
export const revalidate = 3600;

export async function GET() {
  const origin = siteOrigin();
  const categories = await publicSiteService.navCategories();

  const lines = [
    `# ${siteConfig.name}`,
    "",
    `> ${siteConfig.description}`,
    "",
    "این سایت یک رسانه خبری فارسی‌زبان درباره ترکیه است: اخبار روز، قوانین اقامت و",
    "مهاجرت، اقتصاد و راهنمای زندگی برای فارسی‌زبانان ساکن ترکیه. تمام مطالب به زبان",
    "فارسی و با تاریخ انتشار و به‌روزرسانی مشخص منتشر می‌شوند.",
    "",
    "## بخش‌های اصلی",
    `- [آخرین اخبار](${origin}/latest): تازه‌ترین مطالب به ترتیب زمان انتشار`,
    `- [اخبار فوری](${origin}/breaking): رویدادهای مهم و فوری`,
    `- [پربازدیدها](${origin}/most-viewed): پرمخاطب‌ترین مطالب`,
    `- [همه اخبار](${origin}/news): آرشیو کامل با امکان فیلتر`,
    "",
    "## دسته‌بندی‌ها",
    ...categories.map((c) => `- [${c.name}](${origin}/category/${encodeURIComponent(c.slug)})`),
    "",
    "## درباره و سیاست‌ها",
    ...STATIC_PAGES.map((p) => `- [${p.title}](${origin}/${p.slug})`),
    "",
    "## فیدها و نقشه سایت",
    `- [RSS همه مطالب](${origin}/rss.xml)`,
    `- [RSS اخبار فوری](${origin}/rss/breaking.xml)`,
    `- [نقشه سایت](${origin}/sitemap.xml)`,
    `- [نقشه سایت خبری (Google News)](${origin}/news-sitemap.xml)`,
    "",
    "## نکات برای استفاده‌کنندگان ماشینی",
    "- محتوای عمومی قابل نقل‌قول است؛ لطفاً به نشانی صفحه اصلی مطلب ارجاع دهید.",
    "- مسیرهای /admin، /api، /preview و /search خصوصی هستند و نباید خزیده شوند.",
    `- ساختار داده هر مطلب با schema.org NewsArticle در همان صفحه منتشر شده است.`,
    "",
  ];

  return new Response(lines.join("\n"), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
