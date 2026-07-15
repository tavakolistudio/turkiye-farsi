"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function MobileMenu({ categories }: { categories: { name: string; slug: string }[] }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  return (
    <div className="public-mobile-menu">
      <button type="button" className="public-icon-button" aria-expanded={open} aria-controls="mobile-navigation" aria-label={open ? "بستن منو" : "باز کردن منو"} onClick={() => setOpen((value) => !value)}>
        <span aria-hidden>{open ? "×" : "☰"}</span>
      </button>
      {open ? (
        <nav id="mobile-navigation" aria-label="منوی موبایل" className="public-mobile-panel">
          <Link href="/latest" onClick={() => setOpen(false)}>آخرین اخبار</Link>
          <Link href="/breaking" onClick={() => setOpen(false)}>اخبار فوری</Link>
          {categories.map((category) => <Link key={category.slug} href={`/category/${category.slug}`} onClick={() => setOpen(false)}>{category.name}</Link>)}
        </nav>
      ) : null}
    </div>
  );
}
