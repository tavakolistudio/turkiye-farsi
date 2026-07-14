import { withApi } from "@/server/api/handler";
import { enforcePublicRateLimit } from "@/server/api/rate-limit";
import { publicSiteService, type MostViewedWindow } from "@/server/services/public-site.service";
import { ok } from "@/lib/api/response";

export const dynamic = "force-dynamic";

const RANGES: MostViewedWindow[] = ["today", "week", "month", "all"];

export function GET(req: Request) {
  return withApi(async () => {
    enforcePublicRateLimit(req, "public-most-viewed", 120);
    const raw = new URL(req.url).searchParams.get("range");
    const range: MostViewedWindow = RANGES.includes(raw as MostViewedWindow) ? (raw as MostViewedWindow) : "all";
    const rows = await publicSiteService.mostViewed(range, 24);
    return ok(rows, { range });
  });
}
