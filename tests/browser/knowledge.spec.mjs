import { test, expect } from "@playwright/test";
const prose = "#/book/shishuo-xinyu/read/chapter-01";
async function enable(page) {
  await page.goto(prose);
  await expect(page.locator(".entry").first()).toBeVisible();
  await page.locator("#knowledgeBtn").click();
  await expect(page.locator("[data-mention-ids]").first()).toBeVisible();
}
function card(page, testInfo) {
  return testInfo.project.name === "mobile"
    ? page.locator("#researchDialog")
    : page.locator("#researchPanel");
}
test("knowledge is opt-in, preserved, and Google is never fetched automatically", async ({
  page,
}, testInfo) => {
  const external = [];
  page.on("request", (req) => {
    if (req.url().includes("google.com")) external.push(req.url());
  });
  await page.goto(prose);
  await expect(page.locator("[data-mention-ids]")).toHaveCount(0);
  await page.locator("#knowledgeBtn").click();
  await page
    .getByRole("button", { name: "豫章，地名研读", exact: true })
    .first()
    .click();
  const panel = card(page, testInfo);
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("今江西南昌");
  const link = panel.getByRole("link", { name: /Google 地图/ });
  await expect(link).toHaveAttribute("target", "_blank");
  expect(new URL(await link.getAttribute("href")).searchParams.get("api")).toBe(
    "1",
  );
  expect(external).toEqual([]);
  await page.getByRole("button", { name: "关闭名物研读" }).click();
  await page.reload();
  await expect(page.locator("#knowledgeBtn")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator("[data-mention-ids]").first()).toBeVisible();
});
test("merged word notes stay available, image query and copy fallback work", async ({
  page,
}, testInfo) => {
  await page.goto(prose);
  await page.locator("#notesBtn").click();
  await page.locator("#knowledgeBtn").click();
  const word = page.getByRole("button", {
    name: "揽辔，器物研读",
    exact: true,
  });
  await word.click();
  const panel = card(page, testInfo);
  await expect(panel).toContainText("手执马缰");
  await expect(
    panel.getByRole("link", { name: /Google 图片/ }),
  ).toHaveAttribute("href", /tbm=isch/);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async () => {
          throw Error("disabled");
        },
      },
      configurable: true,
    });
  });
  await panel.getByRole("button", { name: "复制检索词" }).click();
  await expect(
    panel.getByRole("textbox", { name: "可复制的检索词" }),
  ).toHaveValue(/缰绳/);
  if (testInfo.project.name === "mobile") {
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press("Tab");
      expect(
        await page.evaluate(() =>
          document
            .querySelector("#researchDialog")
            .contains(document.activeElement),
        ),
      ).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(panel).not.toBeVisible();
    await expect(word).toBeFocused();
  } else await panel.getByRole("button", { name: "关闭名物研读" }).click();
});
test("map card goes to atlas and returns to the exact occurrence", async ({
  page,
}, testInfo) => {
  await enable(page);
  await page
    .getByRole("button", { name: "豫章，地名研读", exact: true })
    .first()
    .click();
  await card(page, testInfo)
    .getByRole("link", { name: "在文学地图中查看 →" })
    .click();
  await expect(page.locator(".atlas-heading")).toContainText("文学地名地图");
  if (testInfo.project.name === "mobile")
    await page.getByRole("button", { name: "地名列表", exact: true }).click();
  await expect(page.locator(".atlas-details")).toContainText("豫章");
  await page.locator(".atlas-citations a").first().click();
  await expect(page).toHaveURL(/mention=m-/);
  await expect(page.locator(".term-target")).toBeVisible();
  await expect(card(page, testInfo)).toContainText("本文语境");
});
test("atlas has local map, semantic filters, merged points and honest unlocated entries", async ({
  page,
}, testInfo) => {
  await page.goto("#/atlas");
  await expect(page.locator(".leaflet-control-zoom")).toBeVisible();
  await expect(page.locator("#literaryMap")).toBeVisible();
  expect(
    await page.locator('#literaryMap svg [role="button"]').count(),
  ).toBeGreaterThan(0);
  await page.getByRole("button", { name: "放大地图" }).click();
  await page.getByRole("button", { name: "重置视野" }).click();
  if (testInfo.project.name === "mobile")
    await page.getByRole("button", { name: "地名列表", exact: true }).click();
  await page.locator("#atlasBook").selectOption("tang-poems");
  await page.locator("#atlasPeriod").selectOption("汉");
  await expect(page.locator(".atlas-count")).toContainText("词例");
  await page.locator("#atlasPeriod").selectOption("");
  await page.locator("#atlasBook").selectOption("");
  await page.locator("#search").fill("荆州");
  await page.locator('[data-place="jingzhou"]').click();
  await expect(page.locator(".atlas-details")).toContainText("定位待考");
  await expect(
    page.locator('#literaryMap svg [role="button"][aria-label^="荆州"]'),
  ).toHaveCount(0);
  await page.locator("#search").fill("zzzzzz");
  await expect(page.locator(".atlas-empty").first()).toContainText("未找到");
  await page.locator("#clearSearch").click();
  await expect(page.locator(".atlas-place").first()).toBeVisible();
});
test("term and map failure paths allow retry and keep reading available", async ({
  page,
}, testInfo) => {
  let fail = true;
  await page.route("**/data/knowledge-entities.json", (r) =>
    fail ? r.abort() : r.continue(),
  );
  await page.goto(prose);
  await page.locator("#knowledgeBtn").click();
  await expect(page.locator("#retryKnowledge")).toBeVisible();
  await expect(page.locator(".entry").first()).toContainText("陈仲举");
  fail = false;
  await page.locator("#retryKnowledge").click();
  await expect(page.locator("[data-mention-ids]").first()).toBeVisible();
  await page.route("**/data/maps/land.geojson", (r) => r.abort());
  await page.locator("#atlasLink").click();
  await expect(page.getByRole("button", { name: "重试地图" })).toBeVisible();
  await expect(page.locator(".atlas-place").first()).toBeVisible();
  await page.unroute("**/data/maps/land.geojson");
  await page.getByRole("button", { name: "重试地图" }).click();
  await expect(page.locator(".leaflet-control-zoom")).toBeVisible();
});
test("unreviewed and stale direct links never publish the excluded meaning", async ({
  page,
}) => {
  await page.goto("#/book/shishuo-xinyu/read/chapter-04");
  await page.locator("#knowledgeBtn").click();
  await expect(page.locator("#knowledgeBtn")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(
    page.getByRole("button", { name: "琴，器物研读", exact: true }),
  ).toHaveCount(0);
  await page.goto(
    "#/atlas?book=tang-poems&period=%E5%94%90&q=%E9%95%BF%E5%AE%89",
  );
  await expect(page.locator(".atlas-count")).toContainText("1 个地名");
});
test("knowledge and atlas layouts fit light, dark and narrow screens", async ({
  page,
}, testInfo) => {
  await enable(page);
  await page
    .getByRole("button", { name: "豫章，地名研读", exact: true })
    .first()
    .click();
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-research.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "关闭名物研读" }).click();
  await page.locator("#themeBtn").click();
  await page.locator("#atlasLink").click();
  await expect(page.locator(".leaflet-control-zoom")).toBeVisible();
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-atlas.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
