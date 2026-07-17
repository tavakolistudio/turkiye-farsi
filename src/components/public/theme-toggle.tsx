"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  const label = dark ? "فعال‌کردن حالت روشن" : "فعال‌کردن حالت تاریک";

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => setTheme(dark ? "light" : "dark")}
      className="editorial-icon-button"
    >
      {dark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
      {!compact && <span className="hidden sm:inline">{dark ? "روشن" : "تاریک"}</span>}
    </button>
  );
}
