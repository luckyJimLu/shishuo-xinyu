import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
const works = JSON.parse(
  await readFile("data/tang-poems.json", "utf8"),
).articles;
const data = JSON.parse(await readFile("data/tang-poems-context.json", "utf8"));
const route = (i) => "#/book/tang-poems/read/" + works[i].id;
test("background is independently available, collapsed initially and keyboard operable", async ({
  page,
}) => {
  await page.goto(route(178));
  const panel = page.locator(".poem-context"),
    summary = panel.locator(":scope > summary");
  await expect(summary).toHaveText("创作背景与诗中情绪");
  await expect(panel).not.toHaveAttribute("open");
  await expect(page.locator(".translation")).toHaveCount(0);
  await expect(page.locator(".annotated")).toHaveCount(0);
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(panel).toHaveAttribute("open");
  await expect(panel).toContainText("815");
  await expect(panel).toContainText("同是天涯沦落人");
  await expect(panel).toContainText("不等于作者真实心理");
  const sources = panel.locator(".context-sources");
  await expect(sources).not.toHaveAttribute("open");
  await sources.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(sources).toHaveAttribute("open");
  await expect(sources.locator("a").first()).toBeVisible();
  await page.keyboard.press("Enter");
  await summary.focus();
  await expect(panel.locator("a").last()).toHaveAttribute(
    "rel",
    "noopener noreferrer",
  );
  await page.keyboard.press("Enter");
  await expect(panel).not.toHaveAttribute("open");
});
test("background errors and invalid fingerprints retain the poem and retry successfully", async ({
  page,
}) => {
  let mode = "fail";
  await page.route("**/data/tang-poems-context.json", (r) => {
    if (mode === "fail") return r.abort();
    if (mode === "ok") return r.continue();
    const bad = structuredClone(data);
    bad.works[works[0].id].sourceHash = "0".repeat(64);
    return r.fulfill({ json: bad });
  });
  await page.goto(route(0));
  await expect(page.locator("#loadStatus")).toContainText("创作背景加载失败");
  await expect(page.locator(".entry")).toHaveCount(4);
  await expect(page.locator(".poem-context")).toHaveCount(0);
  mode = "bad";
  await page.locator("#retryOptional").click();
  await expect(page.locator("#retryOptional")).toBeEnabled();
  await expect(page.locator(".poem-context")).toHaveCount(0);
  mode = "ok";
  await page.locator("#retryOptional").click();
  await expect(page.locator(".poem-context")).toBeVisible();
});
test("late context response cannot contaminate prose and uncertainty stays with its own poem", async ({
  page,
}) => {
  let release;
  const pending = new Promise((r) => (release = r));
  await page.route("**/data/tang-poems-context.json", async (r) => {
    await pending;
    await r.fulfill({ json: data });
  });
  await page.goto(route(0));
  await expect(page.locator("#loadStatus")).toContainText("正在加载创作背景");
  await page.evaluate(
    () => (location.hash = "#/book/shishuo-xinyu/read/chapter-01"),
  );
  await expect(page.locator(".entry")).toHaveCount(47);
  release();
  await expect(page.locator(".poem-context")).toHaveCount(0);
  await page.goto(route(33));
  await page.locator(".poem-context > summary").click();
  await expect(page.locator(".poem-context")).toContainText("署李商隐");
  await page.goto(route(72));
  await page.locator(".poem-context > summary").click();
  await expect(page.locator(".poem-context")).not.toContainText("署李商隐");
});
test("expanded background keeps its position through switches and fits vertical dark mobile reading", async ({
  page,
}, info) => {
  await page.goto(route(177));
  await expect(page.locator("#loadStatus")).toBeEmpty();
  const panel = page.locator(".poem-context");
  await panel.locator(":scope > summary").click();
  await panel.locator(".context-sources > summary").click();
  await panel.evaluate((el) => {
    const r = document.querySelector("#reader"),
      b = el.getBoundingClientRect(),
      a = r.getBoundingClientRect();
    r.scrollBy({ top: b.top - a.top - 20, behavior: "instant" });
  });
  await page.locator("#notesBtn").click();
  await expect(panel).toHaveAttribute("open");
  await expect(panel.locator(".context-sources")).toHaveAttribute("open");
  const offset = () =>
    panel.evaluate(
      (el) =>
        el.getBoundingClientRect().top -
        document.querySelector("#reader").getBoundingClientRect().top,
    );
  await expect.poll(offset).toBeLessThan(30);
  await expect.poll(offset).toBeGreaterThan(-30);
  await page.locator("#dirBtn").click();
  await expect(panel).toHaveAttribute("open");
  await page.locator("#themeBtn").click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  expect(await panel.evaluate((el) => getComputedStyle(el).writingMode)).toBe(
    "vertical-rl",
  );
  expect(
    await panel
      .locator("p")
      .first()
      .evaluate((el) => getComputedStyle(el).writingMode),
  ).toBe("vertical-rl");
  expect(
    await panel.evaluate(
      (el) => el.clientHeight <= document.querySelector("#reader").clientHeight,
    ),
  ).toBe(true);
  expect(
    await page
      .locator(".study-sources")
      .evaluate((el) => getComputedStyle(el).writingMode),
  ).toBe("vertical-rl");
  expect(
    await page
      .locator(".reading-pagination")
      .evaluate((el) => getComputedStyle(el).writingMode),
  ).toBe("vertical-rl");
  await expect(panel.locator(":scope > summary")).toBeInViewport();
  await page.screenshot({
    path: `/tmp/ssxy-poetry-context-${info.project.name}.png`,
  });
});
