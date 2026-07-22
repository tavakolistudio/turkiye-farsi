import "server-only";
import { assertSafeUrl, UrlGuardError } from "../security/url-guard";

/**
 * SSRF-hardened HTTP GET for feeds. Enforces: http/https only, public-IP only
 * (re-validated on every redirect hop → DNS-rebinding resistant), a small
 * redirect cap, a hard response-size cap (streamed, not buffered blindly), a
 * timeout, and a transparent User-Agent. Returns the body plus caching headers.
 */

const USER_AGENT =
  "TurkiyeFarsiNewsroomBot/1.0 (+https://turkiye-farsi.vercel.app; collector; contact: editorial)";
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_REDIRECTS = 3;
const DEFAULT_TIMEOUT_MS = 12_000;

const ALLOWED_CONTENT = /(xml|rss|atom|json|text\/plain|text\/html)/i;

export interface FetchResult {
  status: number;
  notModified: boolean;
  body: string;
  contentType: string | null;
  etag: string | null;
  lastModified: string | null;
  finalUrl: string;
}

export interface FetchOptions {
  etag?: string | null;
  lastModified?: string | null;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export class SafeFetchError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "SafeFetchError";
  }
}

export async function safeFetchFeed(rawUrl: string, opts: FetchOptions = {}): Promise<FetchResult> {
  let current = rawUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const target = await guard(current);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    if (opts.signal) opts.signal.addEventListener("abort", () => controller.abort(), { once: true });

    let res: Response;
    try {
      res = await fetch(target.url.toString(), {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: buildHeaders(opts, hop),
      });
    } catch (err) {
      clearTimeout(timeout);
      if (err instanceof Error && err.name === "AbortError") {
        throw new SafeFetchError("TIMEOUT", "زمان دریافت به پایان رسید.");
      }
      throw new SafeFetchError("NETWORK", "خطای شبکه در دریافت فید.");
    }
    clearTimeout(timeout);

    // Manual redirect handling with per-hop re-validation.
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) throw new SafeFetchError("BAD_REDIRECT", "پاسخ ریدایرکت بدون Location.");
      current = new URL(loc, target.url).toString();
      continue;
    }

    if (res.status === 304) {
      return {
        status: 304,
        notModified: true,
        body: "",
        contentType: res.headers.get("content-type"),
        etag: res.headers.get("etag"),
        lastModified: res.headers.get("last-modified"),
        finalUrl: target.url.toString(),
      };
    }

    if (!res.ok) throw new SafeFetchError("HTTP_" + res.status, `پاسخ نامعتبر: ${res.status}`);

    const contentType = res.headers.get("content-type");
    if (contentType && !ALLOWED_CONTENT.test(contentType)) {
      throw new SafeFetchError("BAD_CONTENT_TYPE", `نوع محتوای غیرمجاز: ${contentType}`);
    }

    const body = await readCapped(res, MAX_BYTES);
    return {
      status: res.status,
      notModified: false,
      body,
      contentType,
      etag: res.headers.get("etag"),
      lastModified: res.headers.get("last-modified"),
      finalUrl: target.url.toString(),
    };
  }
  throw new SafeFetchError("TOO_MANY_REDIRECTS", "تعداد ریدایرکت‌ها بیش از حد مجاز است.");
}

async function guard(url: string) {
  try {
    return await assertSafeUrl(url);
  } catch (err) {
    if (err instanceof UrlGuardError) throw new SafeFetchError(err.code, err.message);
    throw err;
  }
}

function buildHeaders(opts: FetchOptions, hop: number): Record<string, string> {
  const h: Record<string, string> = {
    "user-agent": USER_AGENT,
    accept: "application/rss+xml, application/atom+xml, application/json, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5",
    "accept-encoding": "gzip, deflate, br",
  };
  // Conditional GET only on the first hop.
  if (hop === 0) {
    if (opts.etag) h["if-none-match"] = opts.etag;
    if (opts.lastModified) h["if-modified-since"] = opts.lastModified;
  }
  return h;
}

/** Read a response body but abort once it exceeds `max` bytes. */
async function readCapped(res: Response, max: number): Promise<string> {
  const lenHeader = res.headers.get("content-length");
  if (lenHeader && Number(lenHeader) > max) {
    throw new SafeFetchError("TOO_LARGE", "حجم پاسخ بیش از حد مجاز است.");
  }
  if (!res.body) return await res.text();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > max) {
        await reader.cancel();
        throw new SafeFetchError("TOO_LARGE", "حجم پاسخ بیش از حد مجاز است.");
      }
      chunks.push(value);
    }
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(concat(chunks, total));
}

function concat(chunks: Uint8Array[], total: number): Uint8Array {
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.byteLength;
  }
  return out;
}
