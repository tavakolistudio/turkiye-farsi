"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavigationItem = { name: string; href: string };

export function MainNavigation({ items }: { items: NavigationItem[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="ناوبری اصلی" className="editorial-navigation">
      <ul>
        {items.map((item) => {
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`));
          return (
            <li key={item.href}>
              <Link href={item.href} aria-current={active ? "page" : undefined}>
                {item.name}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
