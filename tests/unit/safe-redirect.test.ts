import { describe, it, expect } from "vitest";
import { safeRedirect } from "@/lib/safe-redirect";

describe("safeRedirect (open-redirect prevention)", () => {
  it("allows same-site path targets", () => {
    expect(safeRedirect("/admin/users")).toBe("/admin/users");
    expect(safeRedirect("/admin?tab=1#x")).toBe("/admin?tab=1#x");
  });

  it("rejects absolute URLs to other origins", () => {
    expect(safeRedirect("http://evil.com")).toBe("/admin");
    expect(safeRedirect("https://evil.com/path")).toBe("/admin");
  });

  it("rejects protocol-relative and backslash tricks", () => {
    expect(safeRedirect("//evil.com")).toBe("/admin");
    expect(safeRedirect("/\\evil.com")).toBe("/admin");
  });

  it("rejects non-path values and falls back", () => {
    expect(safeRedirect("evil.com")).toBe("/admin");
    expect(safeRedirect("")).toBe("/admin");
    expect(safeRedirect(null)).toBe("/admin");
    expect(safeRedirect(undefined)).toBe("/admin");
  });

  it("honors a custom fallback", () => {
    expect(safeRedirect("http://evil.com", "/")).toBe("/");
  });
});
