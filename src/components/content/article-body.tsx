import type { ReactNode } from "react";

type Node = { type?: string; text?: string; attrs?: Record<string, unknown>; marks?: { type?: string; attrs?: Record<string, unknown> }[]; content?: Node[] };

function marked(text: ReactNode, marks: Node["marks"], key: string): ReactNode {
  return (marks ?? []).reduce<ReactNode>((child, mark, index) => {
    if (mark.type === "bold") return <strong key={`${key}-b${index}`}>{child}</strong>;
    if (mark.type === "italic") return <em key={`${key}-i${index}`}>{child}</em>;
    if (mark.type === "strike") return <s key={`${key}-s${index}`}>{child}</s>;
    if (mark.type === "code") return <code key={`${key}-c${index}`}>{child}</code>;
    if (mark.type === "link" && typeof mark.attrs?.href === "string") {
      return <a key={`${key}-a${index}`} href={mark.attrs.href} rel="noopener noreferrer nofollow" target="_blank">{child}</a>;
    }
    return child;
  }, text);
}

function children(node: Node, key: string) {
  return (node.content ?? []).map((child, index) => renderNode(child, `${key}-${index}`));
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
    case "image": return typeof attrs.src === "string" ? <figure key={key}><img src={attrs.src} alt={typeof attrs.alt === "string" ? attrs.alt : ""} /></figure> : null; // eslint-disable-line @next/next/no-img-element
    case "gallery": {
      const images = Array.isArray(attrs.images) ? attrs.images as { src?: string; alt?: string; caption?: string }[] : [];
      return <div className="article-gallery" key={key}>{images.map((image, i) => image.src ? <figure key={`${key}-${i}`}><img src={image.src} alt={image.alt ?? ""} />{image.caption && <figcaption>{image.caption}</figcaption>}</figure> : null)}</div>; // eslint-disable-line @next/next/no-img-element
    }
    case "video": return typeof attrs.src === "string" ? <video key={key} controls preload="metadata" src={attrs.src} /> : null;
    case "table": return <div className="overflow-x-auto" key={key}><table>{children(node, key)}</table></div>;
    case "tableRow": return <tr key={key}>{children(node, key)}</tr>;
    case "tableHeader": return <th key={key}>{children(node, key)}</th>;
    case "tableCell": return <td key={key}>{children(node, key)}</td>;
    case "callout": case "warning": case "infoBox": case "sourceBox": case "faq":
      return <aside key={key} className={`article-box article-box-${node.type}`}><strong>{typeof attrs.title === "string" ? attrs.title : ""}</strong>{children(node, key)}</aside>;
    case "relatedArticle": return <aside key={key} className="article-related">مطلب مرتبط: {String(attrs.title ?? attrs.articleId ?? "")}</aside>;
    case "advertisement": return <aside key={key} className="article-ad" aria-label="تبلیغات">جایگاه تبلیغاتی: {String(attrs.placement ?? "")}</aside>;
    case "fileAttachment": return typeof attrs.url === "string" ? <p key={key}><a href={attrs.url} rel="noopener noreferrer" target="_blank">پیوست: {String(attrs.name ?? "فایل")}</a></p> : null;
    case "doc": return <>{children(node, key)}</>;
    default: return null;
  }
}

export function ArticleBody({ value }: { value: unknown }) {
  return <div className="article-body" dir="rtl">{renderNode((value ?? { type: "doc" }) as Node, "doc")}</div>;
}
