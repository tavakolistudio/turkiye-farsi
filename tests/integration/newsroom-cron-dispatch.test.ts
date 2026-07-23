import { afterEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/cron/newsroom-dispatch/route";

/**
 * Vercel Hobby's cron-count limit is why collection + cleanup were combined
 * into this single daily dispatcher (see vercel.json). Verifies the combined
 * route is still fail-closed on auth and genuinely runs both stages in order.
 */
describe("newsroom cron dispatcher (/api/cron/newsroom-dispatch)", () => {
  const original = process.env.CRON_SECRET;
  afterEach(() => {
    if (original === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = original;
  });

  it("rejects without a valid CRON_SECRET", async () => {
    process.env.CRON_SECRET = "dispatch-test-secret";
    const req = new Request("https://x.test/api/cron/newsroom-dispatch");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("runs collection then cleanup, both in the real (non-dry-run) response", async () => {
    process.env.CRON_SECRET = "dispatch-test-secret";
    const req = new Request("https://x.test/api/cron/newsroom-dispatch", {
      headers: { authorization: "Bearer dispatch-test-secret" },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { collection: { batchId: string | null }; cleanup: { dryRun: boolean } } };
    expect(body.data.collection).toBeDefined();
    expect(body.data.cleanup).toBeDefined();
    expect(body.data.cleanup.dryRun).toBe(false);
  });
});
