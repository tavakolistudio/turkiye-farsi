import { describe, expect, it } from "vitest";
import { availableWorkflowActions, transitionFor } from "@/lib/editorial/workflow";
import { bodyJsonText, safeContentUrl, sanitizeBodyJson } from "@/lib/editorial/content";

describe("editorial transition matrix", () => {
  it("allows the correction loop and rejects an invalid publish", () => {
    expect(transitionFor("DRAFT", "submit_review")?.to).toBe("IN_REVIEW");
    expect(transitionFor("IN_REVIEW", "request_correction")?.to).toBe("NEEDS_CORRECTION");
    expect(transitionFor("NEEDS_CORRECTION", "submit_review")?.to).toBe("IN_REVIEW");
    expect(transitionFor("DRAFT", "publish")).toBeNull();
  });

  it("exposes only actions valid for the current state", () => {
    expect(availableWorkflowActions("SCHEDULED")).toEqual(["cancel_schedule", "publish"]);
  });
});

describe("TipTap JSON sanitization", () => {
  it("drops scripts, unknown nodes and unsafe URL protocols", () => {
    const clean = sanitizeBodyJson({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "خبر امن" }] },
        { type: "script", attrs: { src: "https://evil.test/x.js" } },
        { type: "image", attrs: { src: "javascript:alert(1)", onerror: "x" } },
        { type: "image", attrs: { src: "https://cdn.test/photo.jpg", onerror: "x" } },
      ],
    });
    expect(JSON.stringify(clean)).not.toContain("script");
    expect(JSON.stringify(clean)).not.toContain("javascript:");
    expect(JSON.stringify(clean)).not.toContain("onerror");
    expect(JSON.stringify(clean)).toContain("https://cdn.test/photo.jpg");
    expect(bodyJsonText(clean)).toContain("خبر امن");
  });

  it("allows only local, http and https URLs", () => {
    expect(safeContentUrl("/uploads/a.jpg")).toBe("/uploads/a.jpg");
    expect(safeContentUrl("data:text/html,x")).toBeUndefined();
    expect(safeContentUrl("https://example.com/a")).toBe("https://example.com/a");
  });
});
