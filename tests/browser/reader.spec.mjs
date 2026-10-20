import { test, expect } from "@playwright/test";
async function open(page) {
  await page.goto("");
  await page.getByRole("button", { name: "开始阅读 · 德行第一" }).click();
  await expect(page.locator('[data-entry="1"]')).toBeVisible();
  await expect(page.locator("#loadStatus")).toBeEmpty();
}
async function scrollToEntry(page, n) {
  await page.evaluate((n) => {
    const r = document.querySelector("#reader"),
      el = document.querySelector(`[data-entry="${n}"]`),
      b = el.getBoundingClientRect(),
      bounds = r.getBoundingClientRect();
    r.scrollBy({
      top: r.classList.contains("vertical") ? 0 : b.top - bounds.top - 20,
      left: r.classList.contains("vertical") ? b.right - bounds.right + 20 : 0,
      behavior: "instant",
    });
  }, n);
  await page.waitForTimeout(250);
}
async function anchor(page) {
  return page.evaluate(() => {
    const r = document.querySelector("#reader"),
      bounds = r.getBoundingClientRect(),
      v = r.classList.contains("vertical"),
      ref = v ? bounds.right - 20 : bounds.top + 20;
    return [...document.querySelectorAll("[data-entry]")].find((el) => {
      const b = el.getBoundingClientRect();
      return v
        ? b.left < ref && b.right > bounds.left
        : b.bottom > ref && b.top < bounds.bottom;
    })?.dataset.entry;
  });
}
test("notes, translation defaults, search clear and IME", async ({ page }) => {
  await open(page);
  await expect(page.locator(".translation")).toHaveCount(0);
  await page.locator("#notesBtn").click();
  await expect(page.locator(".liu-note").first()).toBeVisible();
  await page.locator(".liu-note summary").first().click();
  await expect(page.locator(".liu-note[open] p").first()).toBeVisible();
  const search = page.locator("#search");
  await search.fill("陈仲举");
  await expect(page.locator("mark").first()).toHaveText("陈仲举");
  await page.getByRole("button", { name: "清除检索" }).click();
  await expect(search).toBeFocused();
  await expect(page.locator("[data-entry]")).toHaveCount(47);
  await search.dispatchEvent("compositionstart");
  await search.evaluate((el) => {
    el.value = "不存在";
    el.dispatchEvent(
      new InputEvent("input", { bubbles: true, isComposing: true }),
    );
  });
  await expect(page.locator("[data-entry]")).toHaveCount(47);
  await search.dispatchEvent("compositionend");
  await expect(page.locator(".empty")).toContainText("未找到");
});
test("position survives reload, font, note and direction changes; vertical progress", async ({
  page,
}) => {
  await open(page);
  await scrollToEntry(page, 20);
  const before = await anchor(page);
  expect(before).toBe("20");
  await page.reload();
  await expect(page.locator('[data-entry="20"]')).toBeAttached();
  await page.waitForTimeout(200);
  expect(await anchor(page)).toBe(before);
  await page.locator("#plusBtn").click();
  expect(await anchor(page)).toBe(before);
  await page.locator("#notesBtn").click();
  expect(await anchor(page)).toBe(before);
  await page.locator("#dirBtn").click();
  expect(await anchor(page)).toBe(before);
  await scrollToEntry(page, 30);
  expect(
    Number(await page.locator("#progress").getAttribute("aria-valuenow")),
  ).toBeGreaterThan(0);
  await page.reload();
  await page.waitForTimeout(250);
  expect(await anchor(page)).toBe("30");
  await page.locator("#topBtn").click();
  await expect
    .poll(() =>
      page.locator("#reader").evaluate((el) => Math.abs(el.scrollLeft)),
    )
    .toBeLessThan(2);
});
test("auxiliary failure leaves book readable and retry works", async ({
  page,
}) => {
  let fail = true;
  await page.route("**/data/liuxiaobiao-notes.json", (route) =>
    fail ? route.abort() : route.continue(),
  );
  await page.goto("");
  await page.locator("#startBtn").click();
  await expect(page.locator("#loadStatus")).toContainText("刘孝标注加载失败");
  await expect(page.locator(".entry").first()).toContainText("陈仲举");
  fail = false;
  await page.locator("#retryOptional").click();
  await expect(page.locator("#loadStatus")).toBeEmpty();
  await page.locator("#notesBtn").click();
  await expect(page.locator(".liu-note").first()).toBeVisible();
});
test("book error has retry, navigation and home agree", async ({ page }) => {
  await page.route("**/data/shishuo-xinyu.json", (route) =>
    route.fulfill({ status: 500, body: "" }),
  );
  await page.goto("");
  await expect(page.locator("#retryBook")).toBeVisible();
  await page.unroute("**/data/shishuo-xinyu.json");
  await page.locator("#retryBook").click();
  await page.locator("#startBtn").click();
  await page.locator("#homeBtn").click();
  await expect(page.locator('[aria-current="page"]')).toHaveCount(0);
  await page.goBack();
  await expect(page.locator(".chapter-title")).toContainText("德行");
  await page.goForward();
  await expect(page.locator("#startBtn")).toBeVisible();
});
test("narrow drawer keyboard and responsive layout", async ({
  page,
}, testInfo) => {
  await open(page);
  if (testInfo.project.name === "mobile") {
    await page.locator("#menuBtn").click();
    await expect(page.locator("#menuBtn")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await page.keyboard.press("Escape");
    await expect(page.locator("#menuBtn")).toBeFocused();
    await expect(page.locator("#side")).toHaveJSProperty("inert", true);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.locator("#themeBtn").click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-reader.png`,
    fullPage: true,
  });
});
test("slow auxiliary load and unavailable storage do not block reading", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("Blocked", "SecurityError");
      },
    });
  });
  let release;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  await page.route("**/data/liuxiaobiao-notes.json", async (route) => {
    await pending;
    await route.continue();
  });
  await page.goto("");
  await page.locator("#startBtn").click();
  await expect(page.locator(".entry").first()).toContainText("陈仲举");
  await page.locator("#notesBtn").click();
  await page.locator("#themeBtn").click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  release();
  await expect(page.locator(".liu-note").first()).toBeVisible();
});
test("chapter anchors stay independent and unknown routes recover", async ({
  page,
}, testInfo) => {
  await open(page);
  await scrollToEntry(page, 20);
  if (testInfo.project.name === "mobile")
    await page.locator("#menuBtn").click();
  await page.locator('[data-chapter="1"]').click();
  await scrollToEntry(page, 10);
  if (testInfo.project.name === "mobile")
    await page.locator("#menuBtn").click();
  await page.locator('[data-chapter="0"]').click();
  expect(await anchor(page)).toBe("20");
  await page.locator("#search").fill("不存在的检索词");
  await page.locator("#clearSearch").click();
  expect(await anchor(page)).toBe("20");
  await page.goto("#/chapter/%invalid");
  await expect(page.locator("#content")).toContainText("未找到此篇");
  await page.locator("#homeBtn").click();
  await expect(page.locator("#startBtn")).toBeVisible();
});
