import { afterEach, describe, expect, it } from "vitest";
import { isValidCronRequest } from "@/server/security/cron";

describe("cron auth (CRON_SECRET)", () => {
  const original = process.env.CRON_SECRET;
  afterEach(() => {
    if (original === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = original;
  });

  it("20: fails closed when CRON_SECRET is not configured", () => {
    delete process.env.CRON_SECRET;
    const req = new Request("https://x.test/api/cron/newsroom-collect", { headers: { authorization: "Bearer anything" } });
    expect(isValidCronRequest(req)).toBe(false);
  });

  it("20: rejects a missing or wrong bearer token", () => {
    process.env.CRON_SECRET = "test-secret-123";
    expect(isValidCronRequest(new Request("https://x.test/"))).toBe(false);
    expect(isValidCronRequest(new Request("https://x.test/", { headers: { authorization: "Bearer wrong" } }))).toBe(false);
  });

  it("20: accepts the correct Bearer secret", () => {
    process.env.CRON_SECRET = "test-secret-123";
    const req = new Request("https://x.test/", { headers: { authorization: "Bearer test-secret-123" } });
    expect(isValidCronRequest(req)).toBe(true);
  });

  it("20: never accepts the secret via a query string", () => {
    process.env.CRON_SECRET = "test-secret-123";
    const req = new Request("https://x.test/?secret=test-secret-123");
    expect(isValidCronRequest(req)).toBe(false);
  });
});
