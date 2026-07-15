"use client";

import { useState } from "react";
import { Link2, Send, Share2, Check } from "lucide-react";

/**
 * Share controls. The absolute article URL is passed in from the server so the
 * share links render identically on the server and the client (no hydration
 * mismatch). The native share / copy actions read the live location at click
 * time as a best-effort enhancement. No button is ever a dead end.
 */
export function ShareButtons({ title, url }: { title: string; url: string }) {
  const [copied, setCopied] = useState(false);

  // Prefer the live URL at interaction time, fall back to the SSR-provided one.
  const liveUrl = () => (typeof window !== "undefined" ? window.location.href : url);

  async function nativeShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url: liveUrl() });
        return;
      } catch {
        /* user cancelled */
      }
    } else {
      await copy();
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(liveUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  const enc = encodeURIComponent(url);
  const encTitle = encodeURIComponent(title);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-muted-foreground">اشتراک‌گذاری:</span>
      <button
        type="button"
        onClick={nativeShare}
        className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
      >
        <Share2 className="h-4 w-4" aria-hidden="true" /> اشتراک
      </button>
      <a
        href={`https://t.me/share/url?url=${enc}&text=${encTitle}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="اشتراک در تلگرام"
        className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
      >
        <Send className="h-4 w-4" aria-hidden="true" /> تلگرام
      </a>
      <a
        href={`https://api.whatsapp.com/send?text=${encTitle}%20${enc}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="اشتراک در واتساپ"
        className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
      >
        واتساپ
      </a>
      <a
        href={`https://twitter.com/intent/tweet?url=${enc}&text=${encTitle}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="اشتراک در ایکس"
        className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
      >
        ایکس
      </a>
      <button
        type="button"
        onClick={copy}
        className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
      >
        {copied ? <Check className="h-4 w-4 text-primary" aria-hidden="true" /> : <Link2 className="h-4 w-4" aria-hidden="true" />}
        {copied ? "کپی شد" : "کپی لینک"}
      </button>
    </div>
  );
}
