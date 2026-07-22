/**
 * Minimal, dependency-free, XXE-safe XML reader for RSS/Atom feeds.
 *
 * Security: we explicitly REJECT any document declaring a DOCTYPE (which is the
 * vector for XXE / entity-expansion attacks) and we only decode the five
 * predefined entities plus safe numeric character references. No external
 * entities, no DTD processing, ever. Pure — no I/O.
 *
 * This is deliberately a small tree reader, not a full XML DOM. It handles the
 * subset feeds use: nested elements, attributes, CDATA and text. Namespaced
 * tags keep their prefix (e.g. "dc:creator", "media:content").
 */

export interface XmlNode {
  name: string;
  attrs: Record<string, string>;
  children: XmlNode[];
  text: string;
}

export class XmlError extends Error {}

export function parseXml(input: string): XmlNode {
  const src = stripProlog(input);
  const parser = new Parser(src);
  const roots = parser.parseNodes();
  const root = roots.find((n) => n.name);
  if (!root) throw new XmlError("no root element");
  return root;
}

/** Remove the XML declaration and comments; reject DOCTYPE (XXE guard). */
function stripProlog(input: string): string {
  let s = input.replace(/^﻿/, "");
  if (/<!DOCTYPE/i.test(s)) throw new XmlError("DOCTYPE is not allowed");
  if (/<!ENTITY/i.test(s)) throw new XmlError("entity declarations are not allowed");
  s = s.replace(/<\?[\s\S]*?\?>/g, ""); // processing instructions incl. <?xml?>
  s = s.replace(/<!--[\s\S]*?-->/g, ""); // comments
  return s;
}

class Parser {
  private i = 0;
  constructor(private readonly s: string) {}

  parseNodes(): XmlNode[] {
    const nodes: XmlNode[] = [];
    const depth = 0;
    const guardMax = this.s.length + 1;
    let iterations = 0;
    while (this.i < this.s.length) {
      if (++iterations > guardMax * 2) throw new XmlError("parser did not advance");
      const lt = this.s.indexOf("<", this.i);
      if (lt === -1) break;
      this.i = lt;
      if (this.s.startsWith("<![CDATA[", this.i)) {
        this.i = this.s.indexOf("]]>", this.i) + 3;
        continue;
      }
      if (this.s[this.i + 1] === "/") {
        // stray close at top level — stop
        break;
      }
      const node = this.parseElement(depth);
      if (node) nodes.push(node);
    }
    return nodes;
  }

  private parseElement(depth: number): XmlNode | null {
    if (depth > 100) throw new XmlError("max nesting depth exceeded");
    // At a '<'
    const tagEnd = this.s.indexOf(">", this.i);
    if (tagEnd === -1) throw new XmlError("unterminated tag");
    const rawTag = this.s.slice(this.i + 1, tagEnd);
    const selfClosing = rawTag.endsWith("/");
    const inner = selfClosing ? rawTag.slice(0, -1) : rawTag;
    const { name, attrs } = parseTag(inner);
    this.i = tagEnd + 1;
    const node: XmlNode = { name, attrs, children: [], text: "" };
    if (selfClosing || !name) return node;

    const closeTag = `</${name}`;
    let text = "";
    while (this.i < this.s.length) {
      const lt = this.s.indexOf("<", this.i);
      if (lt === -1) throw new XmlError(`unterminated element <${name}>`);
      text += this.s.slice(this.i, lt);
      this.i = lt;
      if (this.s.startsWith("<![CDATA[", this.i)) {
        const end = this.s.indexOf("]]>", this.i);
        if (end === -1) throw new XmlError("unterminated CDATA");
        text += this.s.slice(this.i + 9, end);
        this.i = end + 3;
        continue;
      }
      if (this.s.startsWith("<!--", this.i)) {
        this.i = this.s.indexOf("-->", this.i) + 3;
        continue;
      }
      if (this.s.startsWith(closeTag, this.i)) {
        const gt = this.s.indexOf(">", this.i);
        this.i = gt + 1;
        node.text = decodeEntities(text).trim();
        return node;
      }
      // child element
      const child = this.parseElement(depth + 1);
      if (child) node.children.push(child);
    }
    node.text = decodeEntities(text).trim();
    return node;
  }
}

function parseTag(inner: string): { name: string; attrs: Record<string, string> } {
  const m = inner.match(/^\s*([^\s/>]+)/);
  const name = m ? m[1] : "";
  const attrs: Record<string, string> = {};
  const attrRe = /([^\s=/]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let a: RegExpExecArray | null;
  while ((a = attrRe.exec(inner))) {
    attrs[a[1]] = decodeEntities(a[3] ?? a[4] ?? "");
  }
  return { name, attrs };
}

/** Decode ONLY the five predefined entities and safe numeric refs. */
function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => safeCp(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeCp(parseInt(d, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function safeCp(cp: number): string {
  if (!Number.isFinite(cp) || cp <= 0 || cp > 0x10ffff) return "";
  if (cp < 32 && cp !== 9 && cp !== 10 && cp !== 13) return "";
  try {
    return String.fromCodePoint(cp);
  } catch {
    return "";
  }
}

/** Find the first direct or nested child with the given (namespaced) name. */
export function findChild(node: XmlNode, name: string): XmlNode | undefined {
  return node.children.find((c) => c.name === name || c.name.endsWith(`:${name}`));
}

export function findChildren(node: XmlNode, name: string): XmlNode[] {
  return node.children.filter((c) => c.name === name || c.name.endsWith(`:${name}`));
}

export function childText(node: XmlNode, name: string): string | undefined {
  const c = findChild(node, name);
  return c ? c.text : undefined;
}
