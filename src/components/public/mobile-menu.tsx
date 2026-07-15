"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { SearchBox } from "./search-box";

type NavItem = { name: string; slug: string };

/**
 * Accessible mobile navigation drawer. Opens as a modal dialog: focus is moved
 * in, Escape closes, background scroll is locked, and the toggle button
 * reflects state via aria-expanded.
 */
export function MobileMenu({ categories }: { categories: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="باز کردن منو"
        aria-expanded={open}
        aria-haspopup="dialog"
        className="inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-accent"
      >
        <Menu className="h-6 w-6" aria-hidden="true" />
      </button>

      {open && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label="منوی اصلی"
          className="fixed inset-0 z-50"
        >
          <button
            type="button"
            aria-label="بستن منو"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/50"
          />
          <div
            ref={panelRef}
            className="absolute inset-y-0 right-0 flex w-80 max-w-[85%] flex-col bg-card p-5 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="text-lg font-extrabold">ترکیه فارسی</span>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="بستن منو"
                className="inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-accent"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="mb-4">
              <SearchBox variant="block" />
            </div>

            <nav aria-label="دسته‌بندی‌ها" className="overflow-y-auto">
              <ul className="flex flex-col">
                {categories.map((c) => (
                  <li key={c.slug}>
                    <Link
                      href={`/category/${encodeURIComponent(c.slug)}`}
                      onClick={() => setOpen(false)}
                      className="block rounded-md px-2 py-2.5 font-medium hover:bg-accent"
                    >
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
