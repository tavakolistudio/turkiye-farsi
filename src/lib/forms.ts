import { ZodError } from "zod";
import { ApiError } from "@/lib/api/errors";

/** Standard result shape for admin Server Actions that back forms. */
export interface FormState {
  ok?: boolean;
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
}

/** Convert an unknown thrown error into a FormState (no internal leakage). */
export function toFormError(err: unknown): FormState {
  if (err instanceof ZodError) {
    return { error: "اطلاعات واردشده معتبر نیست.", fieldErrors: err.flatten().fieldErrors };
  }
  if (err instanceof ApiError) {
    return { error: err.message };
  }
  console.error("[form action] unhandled:", err);
  return { error: "خطای غیرمنتظره رخ داد." };
}

/** Read a trimmed string field from FormData, or undefined if empty. */
export function str(fd: FormData, key: string): string | undefined {
  const v = fd.get(key);
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t === "" ? undefined : t;
}

/** Read a checkbox as boolean. */
export function bool(fd: FormData, key: string): boolean {
  const v = fd.get(key);
  return v === "on" || v === "true" || v === "1";
}

/** Read all values of a repeated field (e.g. multi-select) as string[]. */
export function strList(fd: FormData, key: string): string[] {
  return fd.getAll(key).filter((v): v is string => typeof v === "string" && v !== "");
}
