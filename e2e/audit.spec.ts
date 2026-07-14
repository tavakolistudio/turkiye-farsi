import { test, expect } from "@playwright/test";
import pg from "pg";
import { ADMIN, login } from "./helpers";

const CONNECTION =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:54329/turkiye_farsi";

/** Count audit-log rows per action. Robust against timezone/column-type quirks. */
async function actionCounts(): Promise<Record<string, number>> {
  const client = new pg.Client({ connectionString: CONNECTION });
  await client.connect();
  try {
    const res = await client.query(
      `select action, count(*)::int as n from audit_logs group by action`,
    );
    const out: Record<string, number> = {};
    for (const row of res.rows) out[row.action as string] = row.n as number;
    return out;
  } finally {
    await client.end();
  }
}

test("Audit log records login success, login failed and logout", async ({ page }) => {
  const before = await actionCounts();

  // 1) Failed login.
  await login(page, ADMIN.email, "wrong-password-here", { expectFailure: true });
  await expect(page.getByText("ایمیل یا رمز عبور نادرست است.")).toBeVisible();

  // 2) Successful login.
  await login(page, ADMIN.email, ADMIN.password);
  await expect(page).toHaveURL(/\/admin$/);

  // 3) Logout.
  await page.getByRole("button", { name: "خروج" }).click();
  await expect(page).toHaveURL(/\/admin\/login/);

  const after = await actionCounts();
  const delta = (key: string) => (after[key] ?? 0) - (before[key] ?? 0);

  expect(delta("auth.login.failed")).toBeGreaterThanOrEqual(1);
  expect(delta("auth.login.success")).toBeGreaterThanOrEqual(1);
  expect(delta("auth.logout")).toBeGreaterThanOrEqual(1);
});
