/** Auth configuration constants. */
export const AUTH = {
  /** Session cookie name. `__Host-` prefix in prod for strict cookie scoping. */
  cookieName:
    process.env.NODE_ENV === "production" ? "__Host-tf_session" : "tf_session",
  /** Session lifetime (30 days). */
  sessionTtlMs: 30 * 24 * 60 * 60 * 1000,
  /** Password reset token lifetime (1 hour). */
  resetTtlMs: 60 * 60 * 1000,
  /** Login rate limiting. */
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxAttempts: 5, // failed attempts per email+ip within the window
  },
  /** Minimum password length. */
  minPasswordLength: 8,
} as const;
