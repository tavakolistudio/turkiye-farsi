import { getActorContext, withApi } from "@/server/api/handler";
import { readUpload } from "@/server/api/upload";
import { mediaService } from "@/server/services/media.service";
import { ok } from "@/lib/api/response";

export const dynamic = "force-dynamic";

export function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    const ctx = await getActorContext();
    const input = await readUpload(req);
    return ok(await mediaService.replace(ctx, (await params).id, input));
  });
}
