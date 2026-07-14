import { NextResponse, type NextRequest } from "next/server";
import { AUTH } from "@/server/auth/config";
import {
  buildContentSecurityPolicy,
  staticSecurityHeaders,
} from "@/lib/security/headers";

/**
 * Runs on every route. Two responsibilities:
 *  1. Attach security headers (nonce-based CSP + HSTS/nosniff/etc.) to all
 *     responses — public pages AND /admin.
 *  2. Coarse auth gate: bounce unauthenticated /admin requests to login early.
 *     This is NOT authorization — every admin page and Server Action re-checks
 *     the session + permission on the server. The proxy never trusts the cookie.
 */

const PUBLIC_ADMIN_PATHS = [
  "/admin/login",
  "/admin/forgot-password",
  "/admin/reset-password",
];

function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export function proxy(req: NextRequest) {
  const isDev = process.env.NODE_ENV !== "production";
  const nonce = generateNonce();
  const csp = buildContentSecurityPolicy(nonce, {
    isDev,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });

  // Forward the nonce + CSP to the app so Next (and next-themes) can nonce
  // their inline scripts.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const { pathname, search } = req.nextUrl;

  // Auth gate for protected /admin routes.
  if (pathname.startsWith("/admin")) {
    const isPublic = PUBLIC_ADMIN_PATHS.some(
      (p) => pathname === p || pathname.startsWith(p + "/"),
    );
    if (!isPublic && !req.cookies.has(AUTH.cookieName)) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      url.search = `?next=${encodeURIComponent(pathname + search)}`;
      const redirect = NextResponse.redirect(url);
      applyHeaders(redirect, csp, isDev);
      return redirect;
    }
  }

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  applyHeaders(res, csp, isDev);
  return res;
}

function applyHeaders(res: NextResponse, csp: string, isDev: boolean) {
  res.headers.set("Content-Security-Policy", csp);
  for (const [key, value] of Object.entries(staticSecurityHeaders(isDev))) {
    res.headers.set(key, value);
  }
}

export const config = {
  // Run on all routes except static assets and image optimizer.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|woff|woff2|ttf)$).*)",
  ],
};
