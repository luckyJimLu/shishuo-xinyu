import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
const works = JSON.parse(await readFile("data/song-ci.json", "utf8")).articles;
const data = JSON.parse(await readFile("data/song-ci-study.json", "utf8"));
const route = (i) => "#/book/song-ci/read/" + works[i].id;
test("Song notes and complete line translations use the shared preferences", async ({
  page,
}) => {
  await page.goto(route(38));
  await expect(page.locator(".translation")).toHaveCount(0);
  await page.locator("#transBtn").click();
  await expect(page.locator(".translation")).toHaveCount(8);
  await expect(page.locator(".translation").last()).toContainText("共享");
  await page.locator("#notesBtn").click();
  await page.locator(".annotated").filter({ hasText: "婵娟" }).click();
  await expect(page.locator(".note-pop:not([hidden])")).toContainText("明月");
  await page.reload();
  await expect(page.locator(".translation")).toHaveCount(8);
  await expect(page.locator("#notesBtn")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.locator(".study-sources summary").click();
  await expect(page.locator(".study-sources")).toContainText(
    "未经独立专家审校",
  );
  await page.goto(route(279));
  await expect(page.locator(".translation")).toHaveCount(8);
  await expect(page.locator(".translation").last()).toContainText("船舷");
});
test("Song annotation resource failures and invalid hashes preserve reading and retry", async ({
  page,
}) => {
  let mode = "fail";
  await page.route("**/data/song-ci-study.json", (r) => {
    if (mode === "fail") return r.abort();
    if (mode === "good") return r.continue();
    const bad = structuredClone(data);
    bad.poems[works[0].id].lines[0].sourceHash = "0".repeat(64);
    return r.fulfill({ json: bad });
  });
  await page.goto(route(0));
  await expect(page.locator("#retryOptional")).toBeVisible();
  await page.locator("#transBtn").click();
  await expect(page.locator(".translation")).toHaveCount(0);
  mode = "bad";
  await page.locator("#retryOptional").click();
  await expect(page.locator("#retryOptional")).toBeEnabled();
  await expect(page.locator(".translation")).toHaveCount(0);
  mode = "good";
  await page.locator("#retryOptional").click();
  await expect(page.locator(".translation")).toHaveCount(9);
});
test("late Song study responses never overwrite Tang study text", async ({
  page,
}) => {
  let release;
  const pending = new Promise((r) => (release = r));
  await page.route("**/data/song-ci-study.json", async (r) => {
    await pending;
    await r.fulfill({ json: data });
  });
  await page.goto(route(38));
  await page.locator("#transBtn").click();
  await expect(page.locator("#loadStatus")).toContainText("宋词注译");
  await page.goto("#/book/tang-poems");
  await page.locator("#startBtn").click();
  release();
  await expect(page.locator(".translation").first()).toContainText("囚居");
});
test("Song variants and source remarks remain attached to their own work", async ({
  page,
}) => {
  await page.goto(route(16));
  await page.locator("#transBtn").click();
  await expect(page.locator(".translation").last()).toContainText("杨花");
  await page.goto(route(18));
  await expect(page.locator(".translation").last()).toContainText("梨花");
  await page.goto(route(41));
  await expect(page.locator(".translation").last()).toContainText("枫叶");
  await page.locator(".study-sources summary").click();
  await expect(page.locator(".study-sources")).toContainText("寂寞沙洲冷");
});
test("Song study fits dark vertical reading, keyboard notes and search", async ({
  page,
}, info) => {
  await page.goto(route(38));
  await page.locator("#transBtn").click();
  await page.locator("#notesBtn").click();
  await expect(page.locator(".translation")).toHaveCount(8);
  const note = page.locator(".annotated").filter({ hasText: "婵娟" });
  await note.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".note-pop:not([hidden])")).toContainText("明月");
  await page.locator("#dirBtn").click();
  await page.locator("#themeBtn").click();
  await expect(page.locator("#reader")).toHaveClass(/vertical/);
  expect(
    await page
      .locator(".translation")
      .first()
      .evaluate((el) => getComputedStyle(el).writingMode),
  ).toBe("vertical-rl");
  await page.screenshot({
    path: "/tmp/song-study-" + info.project.name + ".png",
  });
  await page.locator("#search").fill("千里共婵娟");
  await expect(page.locator(".work-link")).toHaveCount(1);
  await page.locator("#clearSearch").click();
  await expect(page.locator(".translation")).toHaveCount(8);
});
