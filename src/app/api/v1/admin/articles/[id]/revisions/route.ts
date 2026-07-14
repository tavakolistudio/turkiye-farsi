import { getActorContext, withApi } from "@/server/api/handler";
import { revisionService } from "@/server/services/revision.service";
import { ok } from "@/lib/api/response";

export const dynamic = "force-dynamic";

export function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    const [{ id }, ctx] = await Promise.all([params, getActorContext()]);
    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    return ok(from && to ? await revisionService.compare(ctx, id, from, to) : await revisionService.list(ctx, id));
  });
}
