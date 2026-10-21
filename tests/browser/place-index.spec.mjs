import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
const works = JSON.parse(await readFile("data/song-ci.json", "utf8")).articles;
test("homepage place index lists distinct works, returns to exact text and loads map on demand", async ({
  page,
}) => {
  const geographic = [];
  page.on("request", (r) => {
    if (/\/maps\/.*geojson|leaflet-src/u.test(r.url()))
      geographic.push(r.url());
  });
  await page.goto("");
  await page.getByRole("link", { name: "地名索引 →", exact: true }).click();
  await expect(page.locator(".atlas-count")).toContainText("已复核词例");
  await expect(page.locator(".atlas-map-column")).toBeHidden();
  expect(geographic).toHaveLength(0);
  await page.locator('[data-place="yangzhou"]').click();
  await expect(page.locator(".atlas-details > h2")).toHaveText(
    "扬州 · 相关古文",
  );
  const hrefs = await page
    .locator(".atlas-citations > li > a")
    .evaluateAll((a) => a.map((e) => e.href.split("?")[0]));
  expect(new Set(hrefs).size).toBe(hrefs.length);
  await page.locator(".atlas-citations > li > a").first().click();
  await expect(page).toHaveURL(/mention=m-/);
  await expect(page.locator(".term-target")).toBeVisible();
  await page.goBack();
  await expect(page.locator(".atlas-page")).toHaveAttribute(
    "data-mobile-view",
    "list",
  );
  await expect(page.locator(".atlas-details > h2")).toContainText("扬州");
  if (page.viewportSize().width <= 820) {
    await page.getByRole("button", { name: "重选地名 ↑" }).click();
    await expect(page.locator('[data-place="yangzhou"]')).toBeInViewport();
  }
  await page.getByRole("button", { name: "地图", exact: true }).click();
  await expect(page.locator(".leaflet-container")).toBeVisible();
  expect(geographic.length).toBeGreaterThan(0);
});
test("Song places filter by reviewed context and remain readable without a map", async ({
  page,
}) => {
  await page.goto("#/atlas?view=list&book=song-ci");
  await page.locator("#atlasPeriod").selectOption("宋");
  await page.locator('[data-place="dongting"]').click();
  await expect(page.locator(".atlas-details > h2")).toHaveText(
    "洞庭 · 相关古文",
  );
  await expect(page.locator(".atlas-citations > li")).toHaveCount(1);
  await page.locator(".atlas-citations > li > a").click();
  await expect(page.locator(".poem-title")).toContainText("洞庭青草");
  await page.goBack();
  await page.locator("#search").fill("不存在的地名");
  await expect(page.locator(".atlas-empty").first()).toContainText("未找到");
  await page.locator("#clearSearch").click();
  await expect(page.locator(".atlas-place").first()).toBeVisible();
});
test("plant and daily-object notes show optional Google image links without fetching Google", async ({
  page,
}, info) => {
  const external = [];
  page.on("request", (r) => {
    if (/google\./u.test(r.url())) external.push(r.url());
  });
  await page.goto("#/book/song-ci/read/" + works[3].id);
  await page.locator("#notesBtn").click();
  await page.locator(".annotated").filter({ hasText: "茱萸" }).click();
  const a = page.getByRole("link", { name: /Google 图片 · 植物：茱萸/ });
  await expect(a).toBeVisible();
  await expect(a).toHaveAttribute("target", "_blank");
  await expect(a).toHaveAttribute("rel", "noopener noreferrer");
  const url = new URL(await a.getAttribute("href"));
  expect(url.searchParams.get("q")).toContain("吴茱萸");
  expect(url.searchParams.get("tbm")).toBe("isch");
  await page.locator("#dirBtn").click();
  await expect(a).toBeVisible();
  await expect(a).toBeInViewport();
  await page.screenshot({
    path: "/tmp/plant-note-" + info.project.name + ".png",
  });
  await page.goto("#/book/song-ci/read/" + works[200].id);
  await page.locator(".annotated").filter({ hasText: "金猊" }).click();
  await expect(
    page.getByRole("link", { name: /Google 图片 · 名物：金猊/ }),
  ).toBeVisible();
  expect(external).toHaveLength(0);
});
