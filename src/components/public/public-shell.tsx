import Link from "next/link";
import { MobileMenu } from "@/components/public/mobile-menu";

type JsonRecord = Record<string, unknown>;
const record = (value: unknown): JsonRecord => value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
const text = (value: unknown) => typeof value === "string" ? value : "";

export function PublicHeader({ categories, breaking }: { categories: { name: string; slug: string }[]; breaking: { id: string; title: string; href: string | null; at: Date | null }[] }) {
  return (
    <>
      <header className="public-header">
        <div className="public-header-inner">
          <MobileMenu categories={categories} />
          <Link href="/" className="public-logo" aria-label="ترکیه فارسی، صفحه اصلی"><span>ترکیه</span> فارسی</Link>
          <nav className="public-nav" aria-label="ناوبری اصلی">
            <Link href="/latest">آخرین اخبار</Link>
            <Link href="/breaking">اخبار فوری</Link>
            {categories.slice(0, 6).map((category) => <Link key={category.slug} href={`/category/${category.slug}`}>{category.name}</Link>)}
          </nav>
          <Link href="/search" className="public-icon-button" aria-label="جستجو">⌕</Link>
        </div>
      </header>
      {breaking.length ? (
        <aside className="breaking-bar" aria-label="اخبار فوری">
          <div className="breaking-inner"><strong>فوری</strong><div>{breaking.map((item) => item.href ? <Link key={item.id} href={item.href}>{item.title}</Link> : null)}</div></div>
        </aside>
      ) : null}
    </>
  );
}

export function PublicFooter({ categories, settings }: { categories: { name: string; slug: string }[]; settings: Record<string, unknown> }) {
  const general = record(settings.general);
  const footer = record(settings.footer);
  const socials = record(general.socials);
  const socialEntries = Object.entries(socials).filter((entry): entry is [string, string] => typeof entry[1] === "string" && /^https:\/\//.test(entry[1]));
  return (
    <footer className="public-footer">
      <div className="public-footer-grid">
        <section><h2>ترکیه فارسی</h2><p>{text(footer.about) || text(general.description)}</p></section>
        <section><h2>دسته‌بندی‌ها</h2><nav>{categories.slice(0, 8).map((category) => <Link key={category.slug} href={`/category/${category.slug}`}>{category.name}</Link>)}</nav></section>
        <section><h2>درباره ما</h2><nav><Link href="/about">درباره ما</Link><Link href="/contact">تماس</Link><Link href="/advertising">تبلیغات</Link><Link href="/cooperation">همکاری</Link></nav></section>
        <section><h2>قوانین</h2><nav><Link href="/privacy">حریم خصوصی</Link><Link href="/terms">شرایط استفاده</Link><Link href="/corrections-policy">سیاست اصلاحیه</Link></nav>{socialEntries.map(([name, url]) => <a key={name} href={url} target="_blank" rel="noopener noreferrer">{name}</a>)}</section>
      </div>
      <p className="public-copyright">{text(footer.copyright) || `© ${new Date().getFullYear()} ترکیه فارسی`}</p>
    </footer>
  );
}
