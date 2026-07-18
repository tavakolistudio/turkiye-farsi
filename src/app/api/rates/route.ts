/**
 * Public exchange-rate feed for the header ticker: USD→TRY (Turkish Lira) and
 * USD→Toman (Iran free market). Fetched server-side so the browser never talks
 * to third-party APIs (keeps the strict CSP intact) and cached for 15 minutes.
 * Every source is wrapped defensively — a failing/slow provider yields `null`
 * and the ticker simply omits that figure instead of breaking the page.
 */
export const revalidate = 900; // 15 minutes

async function fetchJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(3500),
      next: { revalidate: 900 },
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** USD→TRY from the free, keyless exchangerate-api mirror. */
async function usdTry(): Promise<number | null> {
  const j = (await fetchJson("https://open.er-api.com/v6/latest/USD")) as
    | { rates?: Record<string, number> }
    | null;
  const v = j?.rates?.TRY;
  return typeof v === "number" && v > 0 ? v : null;
}

/** USD→Toman (Iran free market) from tgju. Price is quoted in Rial → ÷10. */
async function usdToman(): Promise<number | null> {
  const j = (await fetchJson(
    "https://api.tgju.org/v1/market/indicator/summary-table-data/price_dollar_rl",
  )) as { data?: unknown[][] } | null;
  const raw = j?.data?.[0]?.[0];
  if (typeof raw !== "string") return null;
  const rial = Number.parseInt(raw.replace(/[^\d]/g, ""), 10);
  if (!Number.isFinite(rial) || rial <= 0) return null;
  return Math.round(rial / 10);
}

export async function GET() {
  const [try_, toman] = await Promise.all([usdTry(), usdToman()]);
  return Response.json(
    { usdTry: try_, usdToman: toman, updatedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" } },
  );
}
