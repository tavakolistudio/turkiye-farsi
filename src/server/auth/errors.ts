/** Thrown when no authenticated user is present. */
export class AuthenticationError extends Error {
  constructor(message = "برای دسترسی باید وارد شوید.") {
    super(message);
    this.name = "AuthenticationError";
  }
}

/** Thrown when the user is authenticated but lacks the required permission. */
export class AuthorizationError extends Error {
  constructor(message = "شما مجوز انجام این عملیات را ندارید.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

/** Thrown when a request fails the cross-origin / CSRF check. */
export class CsrfError extends Error {
  constructor(message = "درخواست نامعتبر است (بررسی امنیتی مبدأ ناموفق بود).") {
    super(message);
    this.name = "CsrfError";
  }
}
