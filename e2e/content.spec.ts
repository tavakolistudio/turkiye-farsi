import { test, expect } from "@playwright/test";
import { ADMIN, AUTHOR, login } from "./helpers";

// 1x1 transparent PNG.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

const RUN = Date.now();

test.describe("Content CRUD (admin)", () => {
  test("admin can create category, tag, source, media and an article", async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);

    // ── Category ─────────────────────────────
    const catName = `E2E دسته ${RUN}`;
    await page.goto("/admin/categories/new");
    await page.getByLabel("نام", { exact: true }).fill(catName);
    await page.getByRole("button", { name: "ذخیره" }).click();
    await expect(page).toHaveURL(/\/admin\/categories$/);
    await page.goto(`/admin/categories?search=${encodeURIComponent(`دسته ${RUN}`)}`);
    await expect(page.getByText(catName)).toBeVisible();

    // ── Tag ──────────────────────────────────
    const tagName = `E2E-tag-${RUN}`;
    await page.goto("/admin/tags/new");
    await page.getByLabel("نام برچسب").fill(tagName);
    await page.getByRole("button", { name: "ذخیره" }).click();
    await expect(page).toHaveURL(/\/admin\/tags$/);
    await page.goto(`/admin/tags?search=${encodeURIComponent(tagName)}`);
    await expect(page.getByText(tagName, { exact: true })).toBeVisible();

    // ── Source ───────────────────────────────
    const sourceName = `E2E منبع ${RUN}`;
    await page.goto("/admin/sources/new");
    await page.getByLabel("نام منبع").fill(sourceName);
    await page.getByRole("button", { name: "ذخیره" }).click();
    await expect(page).toHaveURL(/\/admin\/sources$/);
    await page.goto(`/admin/sources?search=${encodeURIComponent(`منبع ${RUN}`)}`);
    await expect(page.getByText(sourceName, { exact: true })).toBeVisible();

    // ── Media upload (real file) ─────────────
    await page.goto("/admin/media");
    await page.setInputFiles('input[type="file"]', {
      name: `e2e-${RUN}.png`,
      mimeType: "image/png",
      buffer: PNG,
    });
    await page.getByRole("button", { name: "بارگذاری" }).click();
    await expect(page.getByText(`e2e-${RUN}.png`)).toBeVisible();

    // ── Article ──────────────────────────────
    const title = `E2E مقاله ${RUN}`;
    await page.goto("/admin/articles/new");
    await page.getByLabel("عنوان", { exact: true }).fill(title);
    await page.getByLabel("دسته‌بندی اصلی").selectOption({ label: catName });
    await page.getByLabel(/^متن/).fill("پاراگراف نمونه برای تست E2E.");
    await page.getByRole("button", { name: "ذخیره" }).click();
    await expect(page).toHaveURL(/\/admin\/articles$/);
    await expect(page.getByText(title)).toBeVisible();
  });
});

test.describe("Content authorization", () => {
  test("Author without category.create is blocked from the create page", async ({ page }) => {
    await login(page, AUTHOR.email, AUTHOR.password);
    await page.goto("/admin/categories/new");
    await expect(page).toHaveURL(/\/admin\/forbidden$/);
  });
});
