import { test, expect } from "@playwright/test";
import { ADMIN, login, logout } from "./helpers";

test.describe("Authentication", () => {
  test("guest visiting /admin is redirected to login", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.getByRole("button", { name: "ورود به پنل" })).toBeVisible();
  });

  test("failed login shows an error and stays on login", async ({ page }) => {
    await login(page, ADMIN.email, "definitely-wrong-password", {
      expectFailure: true,
    });
    await expect(page.getByText("ایمیل یا رمز عبور نادرست است.")).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("successful Super Admin login reaches the dashboard", async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { name: "داشبورد" })).toBeVisible();
    await expect(page.getByText("SUPER_ADMIN")).toBeVisible();
  });

  test("safe redirect: login honours a same-site `next`", async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password, { next: "/admin/change-password" });
    await expect(page).toHaveURL(/\/admin\/change-password$/);
    await expect(page.getByRole("heading", { name: "تغییر رمز عبور" })).toBeVisible();
  });

  test("open-redirect is blocked (external `next` is ignored)", async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password, {
      next: "http://evil.example.com/steal",
    });
    // Must land on our own /admin, never on the external host.
    await expect(page).toHaveURL(/http:\/\/localhost:\d+\/admin$/);
    expect(page.url()).not.toContain("evil.example.com");
  });

  test("logout ends the session and re-protects /admin", async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    await expect(page).toHaveURL(/\/admin$/);
    await logout(page);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});
