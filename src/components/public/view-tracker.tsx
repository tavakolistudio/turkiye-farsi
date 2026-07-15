"use client";

import { useEffect } from "react";

export function ViewTracker({ articleId }: { articleId: string }) {
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(`/api/v1/public/articles/${encodeURIComponent(articleId)}/view`, { method: "POST", keepalive: true, signal: controller.signal }).catch(() => undefined);
    }, 1_200);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [articleId]);
  return null;
}
