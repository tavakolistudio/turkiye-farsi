import { z } from "zod";
import { emptyToUndefined, optionalSlug, optionalCuid, metaDescription } from "./common";

export const createCategorySchema = z.object({
  name: z.string().trim().min(2, "نام باید حداقل ۲ کاراکتر باشد.").max(120),
  slug: optionalSlug,
  description: emptyToUndefined(z.string().trim().max(1000)),
  parentId: optionalCuid,
  imageId: optionalCuid,
  order: z.coerce.number().int().min(0).max(9999).default(0),
  isActive: z.coerce.boolean().default(true),
  metaTitle: emptyToUndefined(z.string().trim().max(200)),
  metaDescription,
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = createCategorySchema.partial();
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
