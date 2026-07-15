"use client";

import { useEffect, useRef } from "react";

/**
 * Fires a single, fire-and-forget view-count ping after the article renders.
 * All dedup/bot-filtering happens on the server; the client just signals a
 * genuine page view. Any failure is ignored so tracking can never affect the
 * reading experience.
 */
export function ViewTracker({ slug }: { slug: string }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    const url = `/api/v1/public/articles/${encodeURIComponent(slug)}/view`;
    const body = JSON.stringify({ path: window.location.pathname });
    try {
      // keepalive so the request survives a fast navigation away.
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    } catch {
      /* ignore */
    }
  }, [slug]);
  return null;
}
