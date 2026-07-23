import type { ClassificationResult, TrustResult } from "../types";

/**
 * Build a copyright-safe Persian editorial DRAFT from an ingested item (+ its
 * cluster's sources). Always produces status-agnostic content the newsroom
 * service persists as a DRAFT Article — never PUBLISHED/APPROVED/SCHEDULED.
 *
 * Rule-based baseline is always available; when an AI provider succeeds its
 * fields are merged in. Copyright: we only ever have title + short excerpt, so
 * the body is a brief editorial lead plus explicit source attribution — never a
 * copy of the original article. Legal/immigration items get a disclaimer.
 */

export interface DraftSourceLink {
  name: string;
  url: string;
  isPrimary: boolean;
}

export interface DraftPayload {
  title: string;
  subtitle: string | null;
  summary: string;
  bodyJson: TiptapDoc;
  whyItMatters: string | null;
  whoIsAffected: string | null;
  whatToDo: string | null;
  contentType: string;
  isBreakingSuggestion: boolean;
  factCheckNote: string;
  sourceLinks: DraftSourceLink[];
  metaTitle: string;
  metaDescription: string;
}

export interface TiptapDoc {
  type: "doc";
  content: TiptapNode[];
}
interface TiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
}

export interface DraftInput {
  title: string;
  excerpt: string | null;
  publishedAt: Date | null;
  classification: ClassificationResult;
  trust: TrustResult;
  sources: DraftSourceLink[];
  /** Optional AI-generated fields to merge over the baseline. */
  ai?: Partial<{
    title: string;
    subtitle: string | null;
    summary: string;
    body: string;
    whyItMatters: string | null;
    whoIsAffected: string | null;
    whatToDo: string | null;
    isBreakingSuggestion: boolean;
    metaTitle: string;
    metaDescription: string;
  }>;
}

function p(text: string): TiptapNode {
  return { type: "paragraph", content: text ? [{ type: "text", text }] : [] };
}

const LEGAL_DISCLAIMER =
  "توجه: این خبر جنبه اطلاع‌رسانی دارد و مرجع رسمی نیست. برای تصمیم‌های حقوقی/اقامتی حتماً به منابع رسمی و مشاور معتبر مراجعه کنید.";

export function buildDraft(input: DraftInput): DraftPayload {
  const title = clean(input.ai?.title) ?? input.title;
  const summary =
    clean(input.ai?.summary) ?? (input.excerpt ? shorten(input.excerpt, 300) : shorten(input.title, 160));

  const isLegal = input.classification.sensitivityLevel === "HIGH";
  const uncertain =
    input.trust.requiresHumanFactCheck ||
    input.trust.verificationStatus === "SINGLE_SOURCE" ||
    input.trust.verificationStatus === "UNVERIFIED";

  const body: TiptapNode[] = [];
  const lead = clean(input.ai?.body) ?? summary;
  body.push(p(lead));
  if (uncertain) {
    body.push(p("این خبر هنوز به‌طور کامل تأیید نشده و در حال بررسی است."));
  }
  if (isLegal) body.push(p(LEGAL_DISCLAIMER));
  // Source attribution block — always preserved.
  if (input.sources.length) {
    body.push(p("منابع:"));
    body.push({
      type: "bulletList",
      content: input.sources.map((s) => ({
        type: "listItem",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: s.name,
                marks: [{ type: "link", attrs: { href: s.url, target: "_blank", rel: "noopener nofollow" } }],
              },
            ],
          },
        ],
      })),
    });
  }

  const metaTitle = clean(input.ai?.metaTitle) ?? shorten(title, 60);
  const metaDescription = clean(input.ai?.metaDescription) ?? shorten(summary, 155);

  return {
    title,
    subtitle: clean(input.ai?.subtitle) ?? null,
    summary,
    bodyJson: { type: "doc", content: body },
    // Editorial context only when we actually have AI-derived evidence-based text.
    whyItMatters: clean(input.ai?.whyItMatters) ?? null,
    whoIsAffected: clean(input.ai?.whoIsAffected) ?? input.classification.affectedAudience,
    whatToDo: clean(input.ai?.whatToDo) ?? null,
    contentType: "NEWS",
    isBreakingSuggestion: input.ai?.isBreakingSuggestion ?? false,
    factCheckNote: uncertain ? "نیازمند بررسی انسانی" : "چند منبع/منبع رسمی",
    sourceLinks: input.sources,
    metaTitle,
    metaDescription,
  };
}

function clean(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t.length ? t : null;
}

function shorten(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return t.slice(0, max).replace(/\s+\S*$/, "").trim() + "…";
}
