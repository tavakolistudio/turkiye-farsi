"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type AdminNavItem = { href: string; label: string };

/**
 * Sidebar navigation with an active state. Marking the current section is the
 * one piece of the admin shell that needs the pathname, so it lives in a small
 * client island rather than making the whole layout client-side.
 */
export function AdminNav({ items }: { items: AdminNavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="admin-nav" aria-label="ناوبری اصلی پنل">
      {items.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== "/admin" && pathname.startsWith(`${item.href}/`));
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className="admin-nav-link"
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
