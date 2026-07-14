/**
 * Estimate reading time in minutes. Persian readers average ~200 wpm.
 * Accepts either plain text or a TipTap JSON document.
 */
const WORDS_PER_MINUTE = 200;

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/** Recursively extract text from a TipTap/ProseMirror JSON node. */
export function extractText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as { text?: string; content?: unknown[] };
  let out = n.text ?? "";
  if (Array.isArray(n.content)) {
    out += " " + n.content.map(extractText).join(" ");
  }
  return out;
}

export function readingMinutes(input: string | object): number {
  const text = typeof input === "string" ? input : extractText(input);
  const words = countWords(text);
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}
