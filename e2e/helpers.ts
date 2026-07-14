import { type Page, expect } from "@playwright/test";

/** Credentials from env (admin) and dev seed (editor/author). */
export const ADMIN = {
  email: process.env.INITIAL_ADMIN_EMAIL || "admin@turkiyefarsi.local",
  password: process.env.INITIAL_ADMIN_PASSWORD || "ChangeMe!2026",
};
export const AUTHOR = {
  email: "author@turkiyefarsi.local",
  password: "Author!2026",
};

interface LoginOpts {
  /** Target path to redirect to after login (`next`). */
  next?: string;
  /** Set when the login is expected to fail (stays on the login page). */
  expectFailure?: boolean;
}

/**
 * Log in through the real login form. By default waits for the post-login
 * navigation to complete (so the session cookie is set before the caller acts).
 */
export async function login(
  page: Page,
  email: string,
  password: string,
  opts: LoginOpts = {},
) {
  const url = opts.next
    ? `/admin/login?next=${encodeURIComponent(opts.next)}`
    : "/admin/login";
  await page.goto(url);
  await page.getByLabel("ایمیل").fill(email);
  await page.getByLabel("رمز عبور").fill(password);
  await page.getByRole("button", { name: "ورود به پنل" }).click();

  if (!opts.expectFailure) {
    // Wait until we've navigated away from the login page.
    await page.waitForURL((u) => !u.pathname.endsWith("/admin/login"), {
      timeout: 15_000,
    });
  }
}

/** Log out via the header button. */
export async function logout(page: Page) {
  await page.getByRole("button", { name: "خروج" }).click();
  await expect(page).toHaveURL(/\/admin\/login/);
}
