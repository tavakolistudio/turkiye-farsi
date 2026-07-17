"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicCard } from "@/server/data/article.repo";
import { ArticleCard } from "@/components/public/article-card";
import { trackEvent } from "@/lib/analytics";

type SerializedCard = Omit<PublicCard, "publishedAt"> & { publishedAt: string | null };
type SearchEnvelope = {
  success: boolean;
  data: SerializedCard[];
  meta: { page: number; totalPages: number };
};

export function SearchResults({
  initialRows,
  initialPage,
  totalPages,
  query,
  filters,
}: {
  initialRows: PublicCard[];
  initialPage: number;
  totalPages: number;
  query: string;
  filters: Record<string, string | undefined>;
}) {
  const [rows, setRows] = useState(initialRows);
  const [page, setPage] = useState(initialPage);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    if (loading || page >= totalPages) return;
    setLoading(true);
    setError(false);
    const nextPage = page + 1;
    const params = new URLSearchParams({ q: query, page: String(nextPage) });
    for (const [key, value] of Object.entries(filters)) {
      if (value) params.set(key, value);
    }

    try {
      const response = await fetch(`/api/v1/public/search?${params}`, {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("search request failed");
      const payload = (await response.json()) as SearchEnvelope;
      if (!payload.success) throw new Error("search response failed");
      const nextRows: PublicCard[] = payload.data.map((article) => ({
        ...article,
        publishedAt: article.publishedAt ? new Date(article.publishedAt) : null,
      }));
      setRows((current) => [...current, ...nextRows]);
      setPage(nextPage);
      // Do not send the search phrase to third parties; it can contain PII.
      trackEvent("search_results_load_more", { page: nextPage });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [filters, loading, page, query, totalPages]);

  useEffect(() => {
    const target = sentinel.current;
    if (!target || page >= totalPages) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: "240px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [loadMore, page, totalPages]);

  return (
    <>
      <div data-testid="search-results">
        {rows.map((article, index) => <ArticleCard key={article.id} article={article} variant="list" priority={index === 0} />)}
      </div>
      <div ref={sentinel} className="mt-6 flex min-h-12 items-center justify-center" aria-live="polite">
        {page < totalPages && (
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loading}
            className="rounded-md border border-border bg-background px-5 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
          >
            {loading ? "در حال دریافت…" : error ? "تلاش دوباره" : "نمایش نتایج بیشتر"}
          </button>
        )}
        {page >= totalPages && <span className="sr-only">پایان نتایج</span>}
      </div>
      {page < totalPages && (
        <noscript>
          <a href={`/search?q=${encodeURIComponent(query)}&page=${page + 1}`}>صفحه بعد</a>
        </noscript>
      )}
    </>
  );
}
