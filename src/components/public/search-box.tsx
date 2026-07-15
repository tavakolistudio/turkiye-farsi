"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";

/**
 * Accessible search box. Submits to /search?q=… via client navigation.
 * `variant` adapts it for the header (inline) vs the mobile menu (full width).
 */
export function SearchBox({
  variant = "header",
  autoFocus = false,
  defaultValue = "",
}: {
  variant?: "header" | "block";
  autoFocus?: boolean;
  defaultValue?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = value.trim();
    if (q.length < 2) return;
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <form
      role="search"
      onSubmit={onSubmit}
      className={variant === "header" ? "relative hidden md:block" : "relative w-full"}
    >
      <label htmlFor={`search-${variant}`} className="sr-only">
        جستجو در سایت
      </label>
      <input
        id={`search-${variant}`}
        type="search"
        name="q"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoFocus={autoFocus}
        placeholder="جستجو…"
        className={`w-full rounded-full border border-border bg-background py-2 pr-4 pl-10 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          variant === "header" ? "md:w-56 lg:w-64" : ""
        }`}
      />
      <button
        type="submit"
        aria-label="جستجو"
        className="absolute inset-y-0 left-1 flex items-center justify-center rounded-full px-2 text-muted-foreground hover:text-primary"
      >
        <Search className="h-4 w-4" aria-hidden="true" />
      </button>
    </form>
  );
}
