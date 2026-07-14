import { getActorContext, withApi } from "@/server/api/handler";
import { readUpload } from "@/server/api/upload";
import { mediaService } from "@/server/services/media.service";
import { parseListQuery } from "@/lib/api/pagination";
import { ok } from "@/lib/api/response";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return withApi(async () => {
    const ctx = await getActorContext();
    const sp = new URL(req.url).searchParams;
    const query = {
      ...parseListQuery(sp),
      mimePrefix: sp.get("type") ? `${sp.get("type")}/` : undefined,
      folderId: sp.get("folderId") ?? undefined,
    };
    const { rows, meta } = await mediaService.list(ctx, query);
    return ok(rows, meta);
  });
}

/** Real file upload (multipart/form-data, field `file`). */
export function POST(req: Request) {
  return withApi(async () => {
    const ctx = await getActorContext();
    const input = await readUpload(req);
    return ok(await mediaService.upload(ctx, input), {}, 201);
  });
}
