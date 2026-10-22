import { test, expect } from "@playwright/test";
const route = (n) => "#/book/daxue/read/chapter-" + String(n).padStart(2, "0");
test("Daxue discovery, optional notes and translations persist", async ({
  page,
}) => {
  await page.goto("#/book/daxue");
  await expect(page.locator(".work-list li")).toHaveCount(16);
  await page.locator("#startBtn").click();
  await expect(page.locator(".translation")).toHaveCount(0);
  await page.locator("#notesBtn").click();
  await page.locator(".annotated").filter({ hasText: "亲民" }).click();
  await expect(page.locator(".note-pop:not([hidden])")).toContainText(
    "使民更新",
  );
  await page.locator("#transBtn").click();
  await expect(page.locator(".translation")).toHaveCount(1);
  await expect(page.locator(".translation")).toContainText("百姓");
  await expect(page.locator(".study-sources")).toHaveCount(1);
  await page.goto(route(16));
  await expect(page.locator(".translation")).toContainText("义");
  await page.reload();
  await expect(page.locator(".translation")).toHaveCount(1);
  await page.locator("#dirBtn").click();
  await expect(page.locator("#reader")).toHaveClass(/vertical/);
});
test("Daxue study failure keeps body readable and allows retry", async ({
  page,
}) => {
  let fail = true;
  await page.route("**/data/daxue-study.json", (r) =>
    fail ? r.abort() : r.continue(),
  );
  await page.goto(route(1));
  await expect(page.locator("#retryOptional")).toBeVisible();
  await expect(page.locator(".entry")).toContainText("大学之道");
  await page.locator("#transBtn").click();
  await expect(page.locator(".translation")).toHaveCount(0);
  fail = false;
  await page.locator("#retryOptional").click();
  await expect(page.locator(".translation")).toHaveCount(1);
});
test("late Daxue study cannot overwrite Shishuo with the same chapter id", async ({
  page,
}) => {
  let release;
  const pending = new Promise((r) => (release = r));
  await page.route("**/data/daxue-study.json", async (r) => {
    await pending;
    await r.continue();
  });
  await page.goto(route(1));
  await page.locator("#transBtn").click();
  await expect(page.locator("#loadStatus")).toContainText("正在加载正文注译");
  await page.goto("#/book/shishuo-xinyu/read/chapter-01");
  release();
  await expect(page.locator(".translation").first()).toContainText("陈仲举");
  await expect(page.locator(".chapter-title")).toContainText("德行");
});
