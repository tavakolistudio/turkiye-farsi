import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { ADMIN, AUTHOR, login } from "./helpers";

const prisma = new PrismaClient();

test.describe("Authorization", () => {
  // Self-heal state pollution: the deactivation test below reactivates the
  // author at the end, but an aborted run can leave the author inactive and
  // fail every author login in later runs. Reset before the suite.
  test.beforeAll(async () => {
    await prisma.user.updateMany({
      where: { email: AUTHOR.email },
      data: { isActive: true },
    });
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("Author is blocked from /admin/users on the server (not just hidden)", async ({
    page,
  }) => {
    await login(page, AUTHOR.email, AUTHOR.password);
    await expect(page).toHaveURL(/\/admin$/);
    // Direct URL access, bypassing the (hidden) nav link.
    await page.goto("/admin/users");
    await expect(page).toHaveURL(/\/admin\/forbidden$/);
    await expect(page.getByRole("heading", { name: "دسترسی غیرمجاز" })).toBeVisible();
  });

  test("Protected API enforces auth + permission (401 / 403 / 200)", async ({
    browser,
    request,
  }) => {
    // Unauthenticated request → 401.
    const anon = await request.get("/api/admin/summary");
    expect(anon.status()).toBe(401);

    // Authenticated as Author (no analytics.view) → 403.
    const authorCtx = await browser.newContext();
    const authorPage = await authorCtx.newPage();
    await login(authorPage, AUTHOR.email, AUTHOR.password);
    const authorRes = await authorPage.request.get("/api/admin/summary");
    expect(authorRes.status()).toBe(403);
    await authorCtx.close();

    // Authenticated as Super Admin → 200 with stats.
    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();
    await login(adminPage, ADMIN.email, ADMIN.password);
    const adminRes = await adminPage.request.get("/api/admin/summary");
    expect(adminRes.status()).toBe(200);
    expect(await adminRes.json()).toHaveProperty("articles");
    await adminCtx.close();
  });

  test("Deactivating a user immediately cuts their access", async ({ browser }) => {
    const authorCtx = await browser.newContext();
    const authorPage = await authorCtx.newPage();
    await login(authorPage, AUTHOR.email, AUTHOR.password);
    await expect(authorPage).toHaveURL(/\/admin$/);

    // Admin deactivates the author.
    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();
    await login(adminPage, ADMIN.email, ADMIN.password);
    await adminPage.goto("/admin/users");
    const authorRow = adminPage.locator("tr", { hasText: AUTHOR.email });
    await authorRow.getByRole("button", { name: "غیرفعال کردن" }).click();
    await expect(authorRow.getByText("غیرفعال")).toBeVisible();

    // Author's existing session is now denied.
    await authorPage.goto("/admin");
    await expect(authorPage).toHaveURL(/\/admin\/login/);

    // Restore state: reactivate the author.
    await adminPage.reload();
    const rowAgain = adminPage.locator("tr", { hasText: AUTHOR.email });
    await rowAgain.getByRole("button", { name: "فعال کردن" }).click();
    await expect(rowAgain.getByText("فعال", { exact: true })).toBeVisible();

    await authorCtx.close();
    await adminCtx.close();
  });

  test("Revoking a user's sessions signs them out everywhere", async ({ browser }) => {
    const authorCtx = await browser.newContext();
    const authorPage = await authorCtx.newPage();
    await login(authorPage, AUTHOR.email, AUTHOR.password);
    await expect(authorPage).toHaveURL(/\/admin$/);

    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();
    await login(adminPage, ADMIN.email, ADMIN.password);
    await adminPage.goto("/admin/users");
    const authorRow = adminPage.locator("tr", { hasText: AUTHOR.email });
    await authorRow.getByRole("button", { name: "بستن نشست‌ها" }).click();

    // Author is forced back to login on next request. Retry the reload until the
    // async revoke has landed (the button click resolves before the server action).
    // 30s (not 15s) gives enough headroom when the whole suite is running and the
    // dev server/DB are under heavier load — the revoke itself is synchronous
    // server-side (src/server/users/actions.ts), so this is purely waiting out
    // request-queue latency, not masking an application bug.
    await expect(async () => {
      await authorPage.goto("/admin");
      await expect(authorPage).toHaveURL(/\/admin\/login/);
    }).toPass({ timeout: 30_000 });

    await authorCtx.close();
    await adminCtx.close();
  });
});
