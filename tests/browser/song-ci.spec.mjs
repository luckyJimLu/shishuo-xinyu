import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
const works = JSON.parse(await readFile("data/song-ci.json", "utf8")).articles;
const moon = works.find((w) => w.title === "水调歌头 · 明月几时有");
const route = "#/book/song-ci/read/" + moon.id;

test("Song ci shelf, tune filter and full-text discovery share the reader", async ({
  page,
}) => {
  await page.goto("");
  await page.locator('.book-card[href="#/book/song-ci"]').click();
  await expect(page.locator(".collection-header h1")).toHaveText("宋词选集");
  await expect(page.locator(".work-link")).toHaveCount(40);
  await page.locator("#loadMore").click();
  await expect(page.locator(".work-link")).toHaveCount(80);
  await page.locator("#tuneFilter").selectOption("水调歌头");
  await expect(page.locator(".work-link")).toHaveCount(
    works.filter((w) => w.genre === "水调歌头").length,
  );
  await page.locator("#search").fill("苏轼");
  await expect(page.locator(".work-link")).toHaveCount(1);
  await page.locator(".work-link").click();
  await expect(page.locator(".poem-title")).toHaveText(moon.title);
  await expect(page.locator(".poem-author")).toContainText("宋 · 苏轼");
  await expect(page.locator(".poem-line")).toHaveCount(moon.content.length);
  await expect(page.locator("#notesBtn")).toBeVisible();
  await expect(page.locator("#transBtn")).toBeVisible();
  await expect(page.locator(".poem-context")).toHaveCount(0);
  await page.locator("#search").fill("千里共婵娟");
  await expect(page.locator(".work-link")).toHaveCount(1);
  await page.locator("#clearSearch").click();
  await expect(page.locator(".poem-title")).toHaveText(moon.title);
  await page.locator("#dirBtn").click();
  await page.locator("#themeBtn").click();
  await page.reload();
  await expect(page.locator("#reader")).toHaveClass(/vertical/);
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.locator(".ci-paper")).toBeVisible();
  await page.screenshot({
    path: "/tmp/song-ci-vertical-" + page.viewportSize().width + ".png",
  });
  await page.locator(".reading-pagination a").last().click();
  await expect(page.locator(".poem-title")).not.toHaveText(moon.title);
  await page.locator("#homeBtn").click();
  await expect(page.locator(".resume-link")).toContainText("宋词选集");
});

test("Song ci errors retry, empty filters recover, and no Tang auxiliary data leaks", async ({
  page,
}) => {
  let fail = true;
  await page.route("**/data/song-ci.json", (r) =>
    fail ? r.abort() : r.continue(),
  );
  await page.goto(route);
  await expect(page.locator("#retryBook")).toBeVisible();
  fail = false;
  await page.locator("#retryBook").click();
  await expect(page.locator(".poem-title")).toHaveText(moon.title);
  await page.locator("#search").fill("不存在的宋词");
  await expect(page.locator(".empty")).toBeVisible();
  await page.locator("#clearSearch").click();
  await expect(page.locator(".poem-title")).toHaveText(moon.title);
  await page.goto("#/book/tang-poems");
  await page.locator("#startBtn").click();
  await expect(page.locator("#transBtn")).toBeVisible();
  await page.goto(route);
  await expect(page.locator("#transBtn")).toBeVisible();
  await expect(page.locator(".translation")).toHaveCount(0);
  await expect(page.locator(".poem-context")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
