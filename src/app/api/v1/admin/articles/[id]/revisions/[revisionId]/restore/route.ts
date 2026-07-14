import { z } from "zod";
import { getActorContext, withApi } from "@/server/api/handler";
import { revisionService } from "@/server/services/revision.service";
import { ok } from "@/lib/api/response";

const schema = z.object({ version: z.number().int().nonnegative() });

export function POST(req: Request, { params }: { params: Promise<{ id: string; revisionId: string }> }) {
  return withApi(async () => {
    const [{ id, revisionId }, body, ctx] = await Promise.all([params, req.json(), getActorContext()]);
    const { version } = schema.parse(body);
    return ok(await revisionService.restore(ctx, id, revisionId, version));
  });
}
