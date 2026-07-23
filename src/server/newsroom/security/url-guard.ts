import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * SSRF defence for outbound feed fetches. Every URL we fetch must:
 *  - be http/https only,
 *  - resolve to a PUBLIC IP (never localhost / private / link-local / metadata),
 *  - and (at the pipeline layer) belong to an enabled Source in the registry.
 *
 * We resolve DNS ourselves and validate the resolved addresses to mitigate DNS
 * rebinding — the caller then connects using the already-validated address list.
 */

export class UrlGuardError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "UrlGuardError";
  }
}

/** True for any address that must never be contacted from the server. */
export function isBlockedAddress(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) return isBlockedIPv4(ip);
  if (v === 6) return isBlockedIPv6(ip);
  return true; // not a valid IP → block
}

function isBlockedIPv4(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
  const [a, b] = p;
  if (a === 0) return true; // 0.0.0.0/8 "this host"
  if (a === 10) return true; // private
  if (a === 127) return true; // loopback
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10
  if (a === 169 && b === 254) return true; // link-local + AWS/GCP metadata 169.254.169.254
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 192 && b === 0) return true; // 192.0.0.0/24 IETF
  if (a >= 224) return true; // multicast + reserved
  return false;
}

function isBlockedIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true; // loopback / unspecified
  if (lower.startsWith("fe80")) return true; // link-local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique-local
  if (lower.startsWith("ff")) return true; // multicast
  // IPv4-mapped (::ffff:a.b.c.d) — validate the embedded v4.
  const mapped = lower.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedIPv4(mapped[1]);
  return false;
}

export interface SafeTarget {
  url: URL;
  /** Public IPs the hostname resolved to (already validated). */
  addresses: string[];
}

/**
 * Parse + validate a URL for outbound fetching. Throws UrlGuardError on any
 * violation. Resolves DNS and rejects if ANY resolved address is private —
 * closing DNS-rebinding and split-horizon tricks.
 */
export async function assertSafeUrl(raw: string): Promise<SafeTarget> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UrlGuardError("INVALID_URL", "نشانی نامعتبر است.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UrlGuardError("BAD_PROTOCOL", "فقط http/https مجاز است.");
  }
  if (url.username || url.password) {
    throw new UrlGuardError("HAS_CREDENTIALS", "نشانی نباید حاوی اعتبار باشد.");
  }
  const host = url.hostname;
  if (!host) throw new UrlGuardError("NO_HOST", "میزبان یافت نشد.");

  // If the host is already a literal IP, validate directly.
  if (isIP(host)) {
    if (isBlockedAddress(host)) {
      throw new UrlGuardError("PRIVATE_IP", "دسترسی به IP خصوصی مجاز نیست.");
    }
    return { url, addresses: [host] };
  }

  // Reject obviously-local names before resolving.
  const lowerHost = host.toLowerCase();
  if (lowerHost === "localhost" || lowerHost.endsWith(".localhost") || lowerHost.endsWith(".local")) {
    throw new UrlGuardError("LOCAL_HOST", "دسترسی به میزبان محلی مجاز نیست.");
  }

  let resolved: { address: string }[];
  try {
    resolved = await lookup(host, { all: true });
  } catch {
    throw new UrlGuardError("DNS_FAILED", "resolve نام میزبان ناموفق بود.");
  }
  if (resolved.length === 0) throw new UrlGuardError("DNS_EMPTY", "نام میزبان به آدرسی resolve نشد.");
  for (const { address } of resolved) {
    if (isBlockedAddress(address)) {
      throw new UrlGuardError("PRIVATE_IP", "میزبان به IP خصوصی resolve می‌شود.");
    }
  }
  return { url, addresses: resolved.map((r) => r.address) };
}
