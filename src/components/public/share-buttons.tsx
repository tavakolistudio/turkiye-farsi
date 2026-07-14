"use client";

import { useState } from "react";
import { Link2, Send, Share2, Check } from "lucide-react";

/**
 * Share controls. Uses the native Web Share API when available, and always
 * offers concrete fallbacks (Telegram, X, WhatsApp, copy link) so no button is
 * ever a dead end. The absolute URL is resolved on the client from the current
 * location so it stays correct across environments.
 */
export function ShareButtons({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  const currentUrl = () => (typeof window !== "undefined" ? window.location.href : "");

  async function nativeShare() {
    const url = currentUrl();
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        /* user cancelled — fall through to nothing */
      }
    } else {
      await copy();
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(currentUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  const enc = () => encodeURIComponent(currentUrl());
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
        href={`https://t.me/share/url?url=${enc()}&text=${encTitle}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="اشتراک در تلگرام"
        className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
      >
        <Send className="h-4 w-4" aria-hidden="true" /> تلگرام
      </a>
      <a
        href={`https://api.whatsapp.com/send?text=${encTitle}%20${enc()}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="اشتراک در واتساپ"
        className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
      >
        واتساپ
      </a>
      <a
        href={`https://twitter.com/intent/tweet?url=${enc()}&text=${encTitle}`}
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
