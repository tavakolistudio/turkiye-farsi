import { afterEach, describe, expect, it, vi } from "vitest";

// The SSRF guard resolves DNS itself before connecting; stub it to a fixed
// public address so these tests exercise safeFetchFeed's redirect/size caps
// without touching the real network or tripping the (correct) private-IP block.
vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]),
}));

import { safeFetchFeed, SafeFetchError } from "@/server/newsroom/fetch/safe-fetch";

function fakeResponse(opts: { status: number; headers?: Record<string, string>; chunks?: Uint8Array[] }): Response {
  const headerMap = new Map(Object.entries(opts.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  const chunks = opts.chunks ?? [];
  let i = 0;
  return {
    status: opts.status,
    ok: opts.status >= 200 && opts.status < 300,
    headers: { get: (k: string) => headerMap.get(k.toLowerCase()) ?? null },
    body: {
      getReader: () => ({
        read: async () => (i < chunks.length ? { done: false, value: chunks[i++] } : { done: true, value: undefined }),
        cancel: async () => undefined,
      }),
    },
    text: async () => Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf-8"),
  } as unknown as Response;
}

describe("safeFetchFeed — redirect and size limits", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("24: enforces a hard response-size cap via Content-Length", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => fakeResponse({ status: 200, headers: { "content-length": String(20 * 1024 * 1024) } })),
    );
    await expect(safeFetchFeed("https://big-feed.example.com/rss")).rejects.toMatchObject({ code: "TOO_LARGE" });
  });

  it("24: enforces the size cap on a streamed body with no Content-Length", async () => {
    const chunk = new Uint8Array(3 * 1024 * 1024); // 3MB per chunk, two chunks > 5MB cap
    vi.stubGlobal("fetch", vi.fn(async () => fakeResponse({ status: 200, chunks: [chunk, chunk] })));
    await expect(safeFetchFeed("https://streamed-big.example.com/rss")).rejects.toMatchObject({ code: "TOO_LARGE" });
  });

  it("25: enforces a redirect-count limit", async () => {
    let hop = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        const loc = `https://redirect-${hop}.example.com/rss`;
        hop++;
        return fakeResponse({ status: 302, headers: { location: loc } });
      }),
    );
    await expect(safeFetchFeed("https://redirect-start.example.com/rss")).rejects.toMatchObject({
      code: "TOO_MANY_REDIRECTS",
    });
  });

  it("succeeds under the limits with a normal small response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => fakeResponse({ status: 200, headers: { "content-type": "application/rss+xml" }, chunks: [new TextEncoder().encode("<rss></rss>")] })),
    );
    const result = await safeFetchFeed("https://ok.example.com/rss");
    expect(result.status).toBe(200);
    expect(result.body).toContain("<rss>");
  });
});

describe("SafeFetchError", () => {
  it("carries a machine-readable code", () => {
    const err = new SafeFetchError("TIMEOUT", "زمان دریافت به پایان رسید.");
    expect(err.code).toBe("TIMEOUT");
    expect(err.name).toBe("SafeFetchError");
  });
});
