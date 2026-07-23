import { test, expect } from "@playwright/test";
import { AUTHOR, EDITOR_IN_CHIEF, login } from "./helpers";

const RUN = Date.now();

test("complete Phase 5 editorial scenario", async ({ browser }) => {
  test.setTimeout(120_000);
  const title = `E2E گردش تحریریه ${RUN}`;
  const authorContext = await browser.newContext();
  const authorPage = await authorContext.newPage();
  await login(authorPage, AUTHOR.email, AUTHOR.password);

  await authorPage.goto("/admin/articles/new");
  await authorPage.getByLabel("عنوان", { exact: true }).fill(title);
  await authorPage.getByLabel("دسته‌بندی اصلی").selectOption({ index: 1 });
  await authorPage.locator(".tiptap").fill("این متن کامل خبری برای آزمایش مسیر واقعی گردش کار تحریریه و انتشار زمان‌بندی‌شده است.");
  await authorPage.getByRole("button", { name: "ذخیره", exact: true }).click();
  await expect(authorPage).toHaveURL(/\/admin\/articles$/);

  const listResponse = await authorPage.request.get(`/api/v1/admin/articles?search=${encodeURIComponent(title)}`);
  expect(listResponse.ok()).toBeTruthy();
  const list = await listResponse.json() as { data: { id: string; slug: string }[] };
  const article = list.data.find((item) => item.slug) as { id: string; slug: string };
  expect(article.id).toBeTruthy();

  await authorPage.goto(`/admin/articles/${article.id}/edit`);
  await expect(authorPage.getByText("ذخیره‌شده", { exact: true })).toBeVisible();
  await authorPage.getByLabel("خلاصه").fill("خلاصه‌ای که با autosave واقعی ذخیره می‌شود.");
  await expect(authorPage.getByText("تغییر ذخیره‌نشده", { exact: true })).toBeVisible();
  await expect(authorPage.getByText("ذخیره شد", { exact: true })).toBeVisible({ timeout: 10_000 });
  await authorPage.getByRole("button", { name: "ارسال برای بررسی" }).click();
  await expect(authorPage.getByText("عملیات انجام شد.")).toBeVisible();

  const editorContext = await browser.newContext();
  const editorPage = await editorContext.newPage();
  await login(editorPage, EDITOR_IN_CHIEF.email, EDITOR_IN_CHIEF.password);
  await editorPage.goto(`/admin/articles/${article.id}/edit`);
  editorPage.once("dialog", (dialog) => void dialog.accept("لطفاً تیتر و خلاصه بازبینی شود."));
  await editorPage.getByRole("button", { name: "درخواست اصلاح" }).click();
  await expect(editorPage.getByText("عملیات انجام شد.")).toBeVisible();

  await authorPage.reload();
  await expect(authorPage.getByText("ذخیره‌شده", { exact: true })).toBeVisible();
  await authorPage.getByLabel("خلاصه").fill("خلاصه اصلاح‌شده و نهایی برای انتشار مطلب.");
  await expect(authorPage.getByText("ذخیره شد", { exact: true })).toBeVisible({ timeout: 10_000 });
  await authorPage.getByRole("button", { name: "ارسال برای بررسی" }).click();
  await expect(authorPage.getByText("عملیات انجام شد.")).toBeVisible();

  const sourcesResponse = await editorPage.request.get("/api/v1/admin/sources?pageSize=1");
  const sources = await sourcesResponse.json() as { data: { id: string }[] };
  expect(sources.data[0]?.id).toBeTruthy();
  const attachSource = await editorPage.request.post(`/api/v1/admin/articles/${article.id}/sources`, {
    data: { sourceId: sources.data[0].id, isPrimary: true },
  });
  expect(attachSource.ok()).toBeTruthy();
  await editorPage.goto(`/admin/articles/${article.id}/edit`);
  await editorPage.getByRole("button", { name: "تأیید", exact: true }).click();
  await expect(editorPage.getByText("عملیات انجام شد.")).toBeVisible();

  const scheduledAt = new Date(Date.now() + 5_000).toISOString();
  const schedule = await editorPage.request.post(`/api/v1/admin/articles/${article.id}/workflow`, {
    data: { action: "schedule", scheduledAt },
  });
  expect(schedule.ok()).toBeTruthy();
  await new Promise((resolve) => setTimeout(resolve, 5_200));
  const cron = await editorPage.request.post("/api/cron/publish", {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  expect(cron.ok()).toBeTruthy();

  const publicResponse = await editorPage.request.get(`/api/v1/public/articles?search=${encodeURIComponent(title)}`);
  expect(publicResponse.ok()).toBeTruthy();
  const publicList = await publicResponse.json() as { data: { id: string }[] };
  expect(publicList.data.map((item) => item.id)).toContain(article.id);

  const revisionResponse = await editorPage.request.get(`/api/v1/admin/articles/${article.id}/revisions`);
  const revisions = await revisionResponse.json() as { data: { id: string }[] };
  expect(revisions.data.length).toBeGreaterThanOrEqual(4);

  // currentVersion can legitimately tick between our GET and the restore POST
  // (e.g. a debounced autosave settling late from the tiptap editor's own
  // mount/hydration), the same optimistic-concurrency race a real client
  // handles by refetching and retrying — so mirror that here instead of
  // assuming a single snapshot is always exactly in sync.
  const restore = await (async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const detailResponse = await editorPage.request.get(`/api/v1/admin/articles/${article.id}`);
      const detail = await detailResponse.json() as { data: { currentVersion: number } };
      const res = await editorPage.request.post(`/api/v1/admin/articles/${article.id}/revisions/${revisions.data.at(-1)!.id}/restore`, {
        data: { version: detail.data.currentVersion },
      });
      if (res.ok() || res.status() !== 409) return res;
    }
    throw new Error("restore kept hitting version conflicts");
  })();
  expect(restore.ok()).toBeTruthy();

  const correctionResponse = await editorPage.request.post(`/api/v1/admin/articles/${article.id}/corrections`, {
    data: { title: "اصلاحیه E2E", description: "یک عبارت برای شفافیت بیشتر اصلاح شد.", correctionType: "MINOR", order: 1 },
  });
  expect(correctionResponse.ok()).toBeTruthy();
  const correction = await correctionResponse.json() as { data: { id: string } };
  const publishCorrection = await editorPage.request.post(`/api/v1/admin/articles/${article.id}/corrections/${correction.data.id}/publish`);
  expect(publishCorrection.ok()).toBeTruthy();

  await authorContext.close();
  await editorContext.close();
});
