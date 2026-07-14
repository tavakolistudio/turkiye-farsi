import { getActorContext, withApi } from "@/server/api/handler";
import { sourceService } from "@/server/services/source.service";
import { ok } from "@/lib/api/response";

export const dynamic = "force-dynamic";

export function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    const ctx = await getActorContext();
    return ok(await sourceService.verify(ctx, (await params).id));
  });
}
