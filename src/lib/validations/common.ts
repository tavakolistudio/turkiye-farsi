import { z } from "zod";

/** Treat empty strings (common from HTML forms) as "not provided". */
export const emptyToUndefined = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (v === "" || v === null ? undefined : v), schema.optional());

/** A valid slug: Persian/Latin letters, digits and hyphens only. */
export const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[a-z0-9؀-ۿ-]+$/u, "نامک تنها می‌تواند شامل حروف، اعداد و خط تیره باشد.");

export const optionalSlug = emptyToUndefined(slugSchema);

export const optionalUrl = emptyToUndefined(
  z.string().trim().url("آدرس اینترنتی معتبر نیست.").max(2000),
);

export const cuid = z.string().min(1);
export const optionalCuid = emptyToUndefined(z.string().min(1));

export const metaDescription = emptyToUndefined(
  z.string().trim().max(320, "توضیحات متا نباید بیش از ۳۲۰ کاراکتر باشد."),
);
