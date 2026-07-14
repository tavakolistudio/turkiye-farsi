import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/server/auth/password";

describe("password hashing (scrypt)", () => {
  it("verifies a correct password", async () => {
    const hash = await hashPassword("S3cret!pass");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("S3cret!pass", hash)).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("S3cret!pass");
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });

  it("produces distinct hashes for the same password (random salt)", async () => {
    const a = await hashPassword("same");
    const b = await hashPassword("same");
    expect(a).not.toBe(b);
    expect(await verifyPassword("same", a)).toBe(true);
    expect(await verifyPassword("same", b)).toBe(true);
  });

  it("returns false for malformed stored hashes", async () => {
    expect(await verifyPassword("x", "not-a-valid-hash")).toBe(false);
  });
});
