import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ApiError, type ErrorCode } from "./errors";
import { AuthenticationError, AuthorizationError, CsrfError } from "@/server/auth/errors";

/** Standard success/error envelope shared by every v1 endpoint. */
export interface ApiMeta {
  page?: number;
  pageSize?: number;
  total?: number;
  totalPages?: number;
  [key: string]: unknown;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  error: null;
  meta: ApiMeta;
}

export interface ApiFailure {
  success: false;
  data: null;
  error: { code: ErrorCode | string; message: string; details?: unknown };
  meta: ApiMeta;
}

export function ok<T>(data: T, meta: ApiMeta = {}, status = 200) {
  return NextResponse.json<ApiSuccess<T>>(
    { success: true, data, error: null, meta },
    { status },
  );
}

export function fail(
  code: ErrorCode | string,
  message: string,
  status: number,
  details?: unknown,
) {
  return NextResponse.json<ApiFailure>(
    { success: false, data: null, error: { code, message, details }, meta: {} },
    { status },
  );
}

/**
 * Translate any thrown error into the standard failure envelope, without
 * leaking internals. Known ApiError / ZodError map to precise codes; anything
 * else becomes a generic 500.
 */
export function failFrom(err: unknown) {
  if (err instanceof ApiError) {
    return fail(err.code, err.message, err.status, err.details);
  }
  if (err instanceof ZodError) {
    return fail(
      "VALIDATION_ERROR",
      "اطلاعات واردشده معتبر نیست.",
      422,
      err.flatten().fieldErrors,
    );
  }
  // Map RBAC/CSRF errors to their proper status codes (never a generic 500).
  if (err instanceof AuthenticationError) return fail("UNAUTHENTICATED", err.message, 401);
  if (err instanceof AuthorizationError) return fail("FORBIDDEN", err.message, 403);
  if (err instanceof CsrfError) return fail("BAD_REQUEST", err.message, 400);
  console.error("[api] unhandled error:", err);
  return fail("INTERNAL", "خطای داخلی سرور.", 500);
}
