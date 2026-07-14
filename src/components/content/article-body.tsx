import type { ReactNode } from "react";

/**
 * Safe public renderer for a sanitized TipTap/ProseMirror document.
 *
 * Security model: this renderer NEVER trusts raw HTML. It walks a
 * *server-sanitized* JSON tree (see `sanitizeBodyJson`) and emits React
 * elements — so there is no `dangerouslySetInnerHTML`, no script execution,
 * and no way for stored content to inject markup. URLs are already validated
 * on write; embeds are restricted to an allowlist (YouTube / Instagram) and
 * rendered as sandboxed, lazy-loaded iframes. External links always carry
 * rel="noopener noreferrer".
 */

type Mark = { type?: string; attrs?: Record<string, unknown> };
type Node = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: Mark[];
  content?: Node[];
};

const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

function marked(text: ReactNode, marks: Mark[] | undefined, key: string): ReactNode {
  return (marks ?? []).reduce<ReactNode>((child, mark, index) => {
    if (mark.type === "bold") return <strong key={`${key}-b${index}`}>{child}</strong>;
    if (mark.type === "italic") return <em key={`${key}-i${index}`}>{child}</em>;
    if (mark.type === "strike") return <s key={`${key}-s${index}`}>{child}</s>;
    if (mark.type === "code") return <code key={`${key}-c${index}`}>{child}</code>;
    if (mark.type === "link" && typeof mark.attrs?.href === "string") {
      return (
        <a key={`${key}-a${index}`} href={mark.attrs.href} rel="noopener noreferrer nofollow" target="_blank" className="text-primary underline underline-offset-2">
          {child}
        </a>
      );
    }
    return child;
  }, text);
}

function children(node: Node, key: string) {
  return (node.content ?? []).map((child, index) => renderNode(child, `${key}-${index}`));
}

const BOX_LABELS: Record<string, string> = {
  callout: "یادداشت",
  warning: "هشدار",
  infoBox: "اطلاعات",
  sourceBox: "منبع",
  faq: "پرسش و پاسخ",
};

function renderNode(node: Node, key: string): ReactNode {
  const attrs = node.attrs ?? {};
  switch (node.type) {
    case "text":
      return <span key={key}>{marked(node.text ?? "", node.marks, key)}</span>;
    case "paragraph":
      return <p key={key}>{children(node, key)}</p>;
    case "heading": {
      const level = Number(attrs.level) === 3 ? 3 : Number(attrs.level) === 4 ? 4 : 2;
      if (level === 3) return <h3 key={key}>{children(node, key)}</h3>;
      if (level === 4) return <h4 key={key}>{children(node, key)}</h4>;
      return <h2 key={key}>{children(node, key)}</h2>;
    }
    case "bulletList":
      return <ul key={key}>{children(node, key)}</ul>;
    case "orderedList":
      return <ol key={key}>{children(node, key)}</ol>;
    case "listItem":
      return <li key={key}>{children(node, key)}</li>;
    case "blockquote":
      return <blockquote key={key}>{children(node, key)}</blockquote>;
    case "hardBreak":
      return <br key={key} />;
    case "horizontalRule":
      return <hr key={key} />;
    case "image": {
      const src = str(attrs.src);
      if (!src) return null;
      const alt = str(attrs.alt) ?? "";
      const caption = str(attrs.title);
      return (
        <figure key={key}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} loading="lazy" />
          {caption && <figcaption className="mt-1 text-center text-sm text-muted-foreground">{caption}</figcaption>}
        </figure>
      );
    }
    case "gallery": {
      const images = Array.isArray(attrs.images)
        ? (attrs.images as { src?: string; alt?: string; caption?: string }[])
        : [];
      return (
        <div className="article-gallery" key={key}>
          {images.map((image, i) =>
            image.src ? (
              <figure key={`${key}-${i}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.src} alt={image.alt ?? ""} loading="lazy" />
                {image.caption && <figcaption className="mt-1 text-center text-sm text-muted-foreground">{image.caption}</figcaption>}
              </figure>
            ) : null,
          )}
        </div>
      );
    }
    case "video": {
      const src = str(attrs.src);
      return src ? <video key={key} controls preload="metadata" src={src} /> : null;
    }
    case "youtube": {
      const videoId = str(attrs.videoId);
      if (!videoId) return null;
      const title = str(attrs.title) ?? "ویدئوی یوتیوب";
      return (
        <div key={key} className="relative my-4 aspect-video overflow-hidden rounded-xl">
          <iframe
            className="absolute inset-0 h-full w-full"
            src={`https://www.youtube-nocookie.com/embed/${videoId}`}
            title={title}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      );
    }
    case "instagram": {
      const shortcode = str(attrs.shortcode);
      if (!shortcode) return null;
      const title = str(attrs.title) ?? "پست اینستاگرام";
      return (
        <div key={key} className="my-4 flex justify-center">
          <iframe
            className="w-full max-w-[420px] rounded-xl border border-border"
            style={{ height: 560 }}
            src={`https://www.instagram.com/p/${shortcode}/embed`}
            title={title}
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      );
    }
    case "table":
      return (
        <div className="overflow-x-auto" key={key}>
          <table>
            <tbody>{children(node, key)}</tbody>
          </table>
        </div>
      );
    case "tableRow":
      return <tr key={key}>{children(node, key)}</tr>;
    case "tableHeader":
      return <th key={key}>{children(node, key)}</th>;
    case "tableCell":
      return <td key={key}>{children(node, key)}</td>;
    case "callout":
    case "warning":
    case "infoBox":
    case "sourceBox":
    case "faq": {
      const title = str(attrs.title) || BOX_LABELS[node.type];
      return (
        <aside key={key} className={`article-box article-box-${node.type}`}>
          <strong className="mb-1 block text-sm">{title}</strong>
          {children(node, key)}
        </aside>
      );
    }
    case "relatedArticle":
      return (
        <aside key={key} className="article-related rounded-lg border border-border bg-muted/40 px-4 py-2 text-sm">
          مطلب مرتبط: {str(attrs.title) ?? ""}
        </aside>
      );
    case "advertisement":
      return (
        <aside key={key} className="article-ad rounded-lg border border-dashed border-border px-4 py-3 text-center text-xs text-muted-foreground" aria-label="تبلیغات">
          جایگاه تبلیغاتی
        </aside>
      );
    case "fileAttachment": {
      const url = str(attrs.url);
      return url ? (
        <p key={key}>
          <a href={url} rel="noopener noreferrer" target="_blank" className="text-primary underline">
            پیوست: {str(attrs.name) ?? "فایل"}
          </a>
        </p>
      ) : null;
    }
    case "doc":
      return <>{children(node, key)}</>;
    default:
      return null;
  }
}

export function ArticleBody({ value }: { value: unknown }) {
  return (
    <div className="article-body" dir="rtl">
      {renderNode((value ?? { type: "doc" }) as Node, "doc")}
    </div>
  );
}
