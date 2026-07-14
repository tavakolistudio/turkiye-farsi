import { z } from "zod";
import { getActorContext, withApi } from "@/server/api/handler";
import { notificationService } from "@/server/services/notification.service";
import { ok } from "@/lib/api/response";

const schema = z.object({ id: z.string().cuid() });

export function GET(req: Request) {
  return withApi(async () => {
    const unread = new URL(req.url).searchParams.get("unread") === "true";
    return ok(await notificationService.listMine(await getActorContext(), unread));
  });
}

export function PATCH(req: Request) {
  return withApi(async () => {
    const { id } = schema.parse(await req.json());
    return ok(await notificationService.markRead(await getActorContext(), id));
  });
}
