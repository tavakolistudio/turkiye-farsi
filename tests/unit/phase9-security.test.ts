import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy, staticSecurityHeaders } from "@/lib/security/headers";

describe("Phase 9 security headers", () => {
  it("allows configured analytics endpoints without weakening object/frame policy", () => {
    const csp = buildContentSecurityPolicy("nonce-value", {
      isDev: false,
      gaEnabled: true,
      plausibleScriptUrl: "https://analytics.example.com/js/script.js",
      supabaseUrl: "https://project.supabase.co",
    });
    expect(csp).toContain("'nonce-nonce-value'");
    expect(csp).toContain("https://www.google-analytics.com");
    expect(csp).toContain("https://analytics.example.com");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("ignores an unsafe Plausible script scheme", () => {
    const csp = buildContentSecurityPolicy("n", {
      isDev: false,
      plausibleScriptUrl: "http://analytics.example.com/script.js",
    });
    expect(csp).not.toContain("analytics.example.com");
  });

  it("keeps production transport and browser capability protections", () => {
    expect(staticSecurityHeaders(false)).toMatchObject({
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Strict-Transport-Security": expect.stringContaining("includeSubDomains"),
    });
  });
});
