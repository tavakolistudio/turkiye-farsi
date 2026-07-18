import "server-only";

/**
 * Transactional email via the Resend REST API.
 *
 * Uses `fetch` rather than the SDK so we add no dependency and no cold-start
 * weight. Sending is best-effort and never throws: callers (e.g. password
 * reset) must not change their response based on delivery success, both to
 * avoid user enumeration and to keep auth flows working if the provider is down.
 *
 * Config:
 *   RESEND_API_KEY — required; without it sending is skipped (`not_configured`).
 *   EMAIL_FROM     — verified sender, e.g. "ترکیه فارسی <noreply@yourdomain.com>".
 *                    Falls back to Resend's shared onboarding sender, which can
 *                    only deliver to the Resend account owner's own address.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const FALLBACK_FROM = "Turkiye Farsi <onboarding@resend.dev>";

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export type SendResult = { ok: true } | { ok: false; error: string };

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "not_configured" };

  const from = process.env.EMAIL_FROM?.trim() || FALLBACK_FROM;

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
      // Never let a slow provider hang an auth request.
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });

    if (!res.ok) {
      // Body carries Resend's reason (unverified domain, bad key, ...).
      const detail = (await res.text().catch(() => "")).slice(0, 300);
      return { ok: false, error: `resend_${res.status}: ${detail}` };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "unknown_error" };
  }
}
