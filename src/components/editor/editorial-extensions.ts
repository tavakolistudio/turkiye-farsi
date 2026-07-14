import { Node, mergeAttributes } from "@tiptap/core";

function boxNode(name: string, className: string) {
  return Node.create({
    name,
    group: "block",
    content: "block+",
    defining: true,
    addAttributes() { return { title: { default: "" } }; },
    parseHTML() { return [{ tag: `aside[data-editorial-node="${name}"]` }]; },
    renderHTML({ HTMLAttributes }) {
      return ["aside", mergeAttributes(HTMLAttributes, { "data-editorial-node": name, class: className }), 0];
    },
  });
}

function atomNode(name: string, attributes: Record<string, unknown>) {
  return Node.create({
    name,
    group: "block",
    atom: true,
    draggable: true,
    addAttributes() {
      return Object.fromEntries(Object.entries(attributes).map(([key, value]) => [key, { default: value }]));
    },
    parseHTML() { return [{ tag: `div[data-editorial-node="${name}"]` }]; },
    renderHTML({ HTMLAttributes }) {
      return ["div", mergeAttributes(HTMLAttributes, { "data-editorial-node": name, class: "editorial-atom" }), `بلوک ${name}`];
    },
  });
}

export const Callout = boxNode("callout", "editorial-box editorial-callout");
export const Warning = boxNode("warning", "editorial-box editorial-warning");
export const InfoBox = boxNode("infoBox", "editorial-box editorial-info");
export const SourceBox = boxNode("sourceBox", "editorial-box editorial-source");
export const Faq = boxNode("faq", "editorial-box editorial-faq");
export const Gallery = atomNode("gallery", { images: [] });
export const Video = atomNode("video", { src: "", title: "" });
export const RelatedArticle = atomNode("relatedArticle", { articleId: "", title: "" });
export const Advertisement = atomNode("advertisement", { placement: "IN_ARTICLE" });
export const FileAttachment = atomNode("fileAttachment", { url: "", name: "", mimeType: "application/octet-stream" });

export const editorialExtensions = [
  Callout, Warning, InfoBox, SourceBox, Faq, Gallery, Video, RelatedArticle, Advertisement, FileAttachment,
];
