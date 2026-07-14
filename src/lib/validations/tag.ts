import { z } from "zod";
import { emptyToUndefined, optionalSlug } from "./common";

export const createTagSchema = z.object({
  name: z.string().trim().min(2, "نام برچسب باید حداقل ۲ کاراکتر باشد.").max(80),
  slug: optionalSlug,
  description: emptyToUndefined(z.string().trim().max(500)),
});
export type CreateTagInput = z.infer<typeof createTagSchema>;

export const updateTagSchema = createTagSchema.partial();
export type UpdateTagInput = z.infer<typeof updateTagSchema>;

export const mergeTagSchema = z.object({
  sourceTagId: z.string().min(1),
  targetTagId: z.string().min(1),
});
export type MergeTagInput = z.infer<typeof mergeTagSchema>;
