"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { SearchBox } from "./search-box";
import { ThemeToggle } from "./theme-toggle";
import type { NavigationItem } from "./main-navigation";

/**
 * Accessible mobile navigation drawer. Opens as a modal dialog: focus is moved
 * in, Escape closes, background scroll is locked, and the toggle button
 * reflects state via aria-expanded.
 */
export function MobileMenu({ items }: { items: NavigationItem[] }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    const toggle = toggleRef.current;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "Tab" && panelRef.current) {
        const focusable = Array.from(
          panelRef.current.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        );
        const first = focusable[0];
        const last = focusable.at(-1);
        if (!first || !last) return;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      toggle?.focus();
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        ref={toggleRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="باز کردن منو"
        aria-expanded={open}
        aria-haspopup="dialog"
        className="editorial-menu-toggle"
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
            className="editorial-mobile-panel"
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="font-headline text-xl font-black">ترکیه فارسی</span>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="بستن منو"
                className="editorial-menu-toggle"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="mb-4">
              <SearchBox variant="block" />
            </div>

            <nav aria-label="ناوبری موبایل" className="overflow-y-auto">
              <ul className="flex flex-col">
                {items.map((item) => {
                  const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`));
                  return <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className="editorial-mobile-link"
                    >
                      {item.name}
                    </Link>
                  </li>;
                })}
              </ul>
            </nav>
            <div className="mt-auto border-t border-border pt-4">
              <ThemeToggle />
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
