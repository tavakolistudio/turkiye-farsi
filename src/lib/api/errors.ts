/**
 * Stable, typed application error with a machine-readable code, a human
 * message (Persian), and an HTTP status. Services throw these; the API layer
 * and Server Actions translate them into the standard response envelope.
 */
export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "SLUG_TAKEN"
  | "IN_USE"
  | "RATE_LIMITED"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "BAD_REQUEST"
  | "CIRCULAR_REFERENCE"
  | "INTERNAL";

const DEFAULT_STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 422,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  SLUG_TAKEN: 409,
  IN_USE: 409,
  RATE_LIMITED: 429,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  BAD_REQUEST: 400,
  CIRCULAR_REFERENCE: 409,
  INTERNAL: 500,
};

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = DEFAULT_STATUS[code];
    this.details = details;
  }

  static notFound(message = "موردی یافت نشد.") {
    return new ApiError("NOT_FOUND", message);
  }
  static forbidden(message = "شما مجوز انجام این عملیات را ندارید.") {
    return new ApiError("FORBIDDEN", message);
  }
  static unauthenticated(message = "برای دسترسی باید وارد شوید.") {
    return new ApiError("UNAUTHENTICATED", message);
  }
  static validation(message = "اطلاعات واردشده معتبر نیست.", details?: unknown) {
    return new ApiError("VALIDATION_ERROR", message, details);
  }
  static slugTaken(message = "این نامک قبلاً استفاده شده است.") {
    return new ApiError("SLUG_TAKEN", message);
  }
  static conflict(message = "تعارض در داده‌ها.") {
    return new ApiError("CONFLICT", message);
  }
  static inUse(message = "این مورد در حال استفاده است و قابل حذف نیست.") {
    return new ApiError("IN_USE", message);
  }
}
