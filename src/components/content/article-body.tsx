import type { ReactNode } from "react";

type Node = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type?: string; attrs?: Record<string, unknown> }[];
  content?: Node[];
};

const EMBED_HOSTS = new Set(["www.youtube.com", "youtube.com", "youtu.be", "www.instagram.com", "instagram.com"]);

export function safePublicUrl(value: unknown, kind: "link" | "media" | "embed" = "link"): string | null {
  if (typeof value !== "string" || value.length > 2_000) return null;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    if (kind === "embed" && !EMBED_HOSTS.has(url.hostname.toLowerCase())) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function embedUrl(value: unknown): string | null {
  const safe = safePublicUrl(value, "embed");
  if (!safe) return null;
  const url = new URL(safe);
  if (url.hostname === "youtu.be") return `https://www.youtube.com/embed/${encodeURIComponent(url.pathname.slice(1))}`;
  if (url.hostname.endsWith("youtube.com")) {
    const id = url.searchParams.get("v") ?? url.pathname.split("/").filter(Boolean).at(-1);
    return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}` : null;
  }
  if (url.hostname.endsWith("instagram.com")) {
    const parts = url.pathname.split("/").filter(Boolean);
    const index = parts.findIndex((part) => part === "p" || part === "reel");
    return index >= 0 && parts[index + 1] ? `https://www.instagram.com/${parts[index]}/${encodeURIComponent(parts[index + 1])}/embed` : null;
  }
  return null;
}

function marked(text: ReactNode, marks: Node["marks"], key: string): ReactNode {
  return (marks ?? []).reduce<ReactNode>((child, mark, index) => {
    if (mark.type === "bold") return <strong key={`${key}-b${index}`}>{child}</strong>;
    if (mark.type === "italic") return <em key={`${key}-i${index}`}>{child}</em>;
    if (mark.type === "strike") return <s key={`${key}-s${index}`}>{child}</s>;
    if (mark.type === "code") return <code key={`${key}-c${index}`}>{child}</code>;
    if (mark.type === "link") {
      const href = safePublicUrl(mark.attrs?.href);
      if (!href) return child;
      const external = href.startsWith("https://");
      return <a key={`${key}-a${index}`} href={href} rel={external ? "noopener noreferrer nofollow" : undefined} target={external ? "_blank" : undefined}>{child}</a>;
    }
    return child;
  }, text);
}

function children(node: Node, key: string) {
  return (node.content ?? []).map((child, index) => renderNode(child, `${key}-${index}`));
}

function PublicImage({ src, alt, caption }: { src: string; alt: string; caption?: string }) {
  return (
    <figure>
      {/* Dynamic editorial media may come from configured storage domains. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" />
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}

function renderNode(node: Node, key: string): ReactNode {
  const attrs = node.attrs ?? {};
  switch (node.type) {
    case "text": return <span key={key}>{marked(node.text ?? "", node.marks, key)}</span>;
    case "paragraph": return <p key={key}>{children(node, key)}</p>;
    case "heading": {
      const level = Number(attrs.level) === 3 ? 3 : Number(attrs.level) === 4 ? 4 : 2;
      if (level === 3) return <h3 key={key}>{children(node, key)}</h3>;
      if (level === 4) return <h4 key={key}>{children(node, key)}</h4>;
      return <h2 key={key}>{children(node, key)}</h2>;
    }
    case "bulletList": return <ul key={key}>{children(node, key)}</ul>;
    case "orderedList": return <ol key={key}>{children(node, key)}</ol>;
    case "listItem": return <li key={key}>{children(node, key)}</li>;
    case "blockquote": return <blockquote key={key}>{children(node, key)}</blockquote>;
    case "hardBreak": return <br key={key} />;
    case "horizontalRule": return <hr key={key} />;
    case "image": {
      const src = safePublicUrl(attrs.src, "media");
      return src ? <PublicImage key={key} src={src} alt={typeof attrs.alt === "string" ? attrs.alt : ""} caption={typeof attrs.caption === "string" ? attrs.caption : undefined} /> : null;
    }
    case "gallery": {
      const images = Array.isArray(attrs.images) ? attrs.images as { src?: string; alt?: string; caption?: string }[] : [];
      return <div className="article-gallery" key={key}>{images.map((image, index) => {
        const src = safePublicUrl(image.src, "media");
        return src ? <PublicImage key={`${key}-${index}`} src={src} alt={image.alt ?? ""} caption={image.caption} /> : null;
      })}</div>;
    }
    case "video": {
      const src = safePublicUrl(attrs.src, "media");
      return src ? <video key={key} controls preload="metadata" src={src} playsInline /> : null;
    }
    case "youtube": case "instagram": case "embed": {
      const src = embedUrl(attrs.src ?? attrs.url);
      return src ? <div className="article-embed" key={key}><iframe src={src} title={typeof attrs.title === "string" ? attrs.title : "محتوای تعبیه‌شده"} loading="lazy" sandbox="allow-scripts allow-same-origin allow-popups" referrerPolicy="strict-origin-when-cross-origin" allow="encrypted-media; picture-in-picture" allowFullScreen /></div> : null;
    }
    case "table": return <div className="article-table" key={key}><table>{children(node, key)}</table></div>;
    case "tableRow": return <tr key={key}>{children(node, key)}</tr>;
    case "tableHeader": return <th key={key}>{children(node, key)}</th>;
    case "tableCell": return <td key={key}>{children(node, key)}</td>;
    case "callout": case "warning": case "infoBox": case "sourceBox": case "faq":
      return <aside key={key} className={`article-box article-box-${node.type}`}><strong>{typeof attrs.title === "string" ? attrs.title : ""}</strong>{children(node, key)}</aside>;
    case "relatedArticle": {
      const href = typeof attrs.slug === "string" ? `/news/${encodeURIComponent(attrs.slug)}` : null;
      return href ? <aside key={key} className="article-related"><a href={href}>مطلب مرتبط: {String(attrs.title ?? "مشاهده مطلب")}</a></aside> : null;
    }
    case "advertisement": {
      const href = safePublicUrl(attrs.url);
      const image = safePublicUrl(attrs.imageUrl, "media");
      return href && image ? <aside key={key} className="article-ad" aria-label="تبلیغات"><a href={href} rel="noopener noreferrer sponsored" target="_blank"><PublicImage src={image} alt={String(attrs.alt ?? "تبلیغ")} /></a></aside> : null;
    }
    case "fileAttachment": {
      const href = safePublicUrl(attrs.url, "media");
      return href ? <p key={key}><a href={href} rel="noopener noreferrer" target={href.startsWith("https://") ? "_blank" : undefined}>پیوست: {String(attrs.name ?? "فایل")}</a></p> : null;
    }
    case "doc": return <>{children(node, key)}</>;
    default: return null;
  }
}

export function ArticleBody({ value }: { value: unknown }) {
  const document = value && typeof value === "object" ? value as Node : { type: "doc" };
  return <div className="article-body" dir="rtl">{renderNode(document, "doc")}</div>;
}
