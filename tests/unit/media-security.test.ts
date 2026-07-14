import { describe, it, expect } from "vitest";
import {
  validateUpload,
  safeStoredFilename,
  MAX_UPLOAD_BYTES,
} from "@/server/storage/adapter";
import { ApiError } from "@/lib/api/errors";

describe("upload validation (MIME + size allowlist)", () => {
  it("accepts an allowed image type within the size limit", () => {
    expect(() => validateUpload("image/png", 1000)).not.toThrow();
    expect(() => validateUpload("video/mp4", 1000)).not.toThrow();
    expect(() => validateUpload("application/pdf", 1000)).not.toThrow();
  });

  it("rejects executables and scripts (not on the allowlist)", () => {
    expect(() => validateUpload("application/x-msdownload", 100)).toThrow(ApiError);
    expect(() => validateUpload("text/html", 100)).toThrow(ApiError);
    expect(() => validateUpload("image/svg+xml", 100)).toThrow(ApiError); // SVG blocked (XSS)
  });

  it("rejects empty and oversized files", () => {
    expect(() => validateUpload("image/png", 0)).toThrow(ApiError);
    expect(() => validateUpload("image/png", MAX_UPLOAD_BYTES + 1)).toThrow(ApiError);
  });
});

describe("safe stored filename (path-traversal prevention)", () => {
  it("strips directory components and unsafe chars", () => {
    const name = safeStoredFilename("../../etc/passwd", "image/png");
    expect(name).not.toContain("/");
    expect(name).not.toContain("..");
    expect(name.endsWith(".png")).toBe(true);
  });

  it("always yields a non-empty base and correct extension", () => {
    const name = safeStoredFilename("!!!.jpg", "image/jpeg");
    expect(name.endsWith(".jpg")).toBe(true);
    expect(name.length).toBeGreaterThan(5);
  });
});
