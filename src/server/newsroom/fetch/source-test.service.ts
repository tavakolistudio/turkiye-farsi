import "server-only";
import { safeFetchFeed, SafeFetchError } from "./safe-fetch";
import { parseFeed } from "./parse-feed";

/**
 * Test a feed URL WITHOUT persisting anything. Runs the exact same SSRF-hardened
 * fetch + parse the pipeline uses, so a green test means collection will work.
 * On any error it returns a safe, structured result (never throws to the caller).
 */

export interface FeedTestResult {
  ok: boolean;
  itemCount: number;
  feedTitle: string | null;
  sampleTitles: string[];
  contentType: string | null;
  etag: string | null;
  lastModified: string | null;
  error?: { code: string; message: string };
}

export async function testFeed(url: string, timeoutMs = 12_000): Promise<FeedTestResult> {
  const empty: FeedTestResult = {
    ok: false, itemCount: 0, feedTitle: null, sampleTitles: [], contentType: null, etag: null, lastModified: null,
  };
  try {
    const res = await safeFetchFeed(url, { timeoutMs });
    if (res.notModified) {
      return { ...empty, ok: true, contentType: res.contentType, etag: res.etag, lastModified: res.lastModified };
    }
    const feed = parseFeed(res.body, res.contentType);
    return {
      ok: feed.items.length > 0,
      itemCount: feed.items.length,
      feedTitle: feed.title ?? null,
      sampleTitles: feed.items.slice(0, 5).map((i) => i.title),
      contentType: res.contentType,
      etag: res.etag,
      lastModified: res.lastModified,
      ...(feed.items.length === 0 ? { error: { code: "EMPTY_FEED", message: "فیدی بدون آیتم." } } : {}),
    };
  } catch (err) {
    if (err instanceof SafeFetchError) {
      return { ...empty, error: { code: err.code, message: err.message } };
    }
    return { ...empty, error: { code: "PARSE_ERROR", message: "خطا در تجزیه فید." } };
  }
}
