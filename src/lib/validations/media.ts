import { z } from "zod";
import { MEDIA_ROLES } from "@/lib/content-enums";
import { emptyToUndefined, optionalCuid } from "./common";

/** Editable metadata for an existing media item. */
export const updateMediaSchema = z.object({
  alt: emptyToUndefined(z.string().trim().max(300)),
  caption: emptyToUndefined(z.string().trim().max(500)),
  credit: emptyToUndefined(z.string().trim().max(200)),
  folderId: optionalCuid,
});
export type UpdateMediaInput = z.infer<typeof updateMediaSchema>;

export const createFolderSchema = z.object({
  name: z.string().trim().min(1, "نام پوشه الزامی است.").max(120),
  parentId: optionalCuid,
});
export type CreateFolderInput = z.infer<typeof createFolderSchema>;

/** Attach a media item to an article (gallery/inline/attachment/etc.). */
export const attachMediaSchema = z.object({
  mediaId: z.string().min(1),
  role: z.enum(MEDIA_ROLES).default("INLINE"),
  order: z.coerce.number().int().min(0).max(999).default(0),
  captionOverride: emptyToUndefined(z.string().trim().max(500)),
});
export type AttachMediaInput = z.infer<typeof attachMediaSchema>;
