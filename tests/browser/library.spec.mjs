import { test, expect } from "@playwright/test";
const poemId = "ca2c489a-e433-4c0f-8248-77d354f0665e";
async function poems(page) {
  await page.goto("#/book/tang-poems");
  await expect(page.locator(".collection-header h1")).toHaveText("唐诗选读");
}
test("library opens both books and supports discovery", async ({ page }) => {
  await page.goto("");
  await expect(page).toHaveTitle("中国古典文学 · 诗文藏书");
  await expect(page.locator(".book-card")).toHaveCount(3);
  await page.locator("#search").fill("唐诗");
  await expect(page.locator(".book-card")).toHaveCount(1);
  await page.locator(".book-card").click();
  await expect(page.locator(".collection-header h1")).toHaveText("唐诗选读");
  await expect(page.locator(".work-list li")).toHaveCount(40);
  await page.locator("#loadMore").click();
  await expect(page.locator(".work-list li")).toHaveCount(80);
  await page.locator('[data-genre="五言绝句"]').click();
  await expect(page.locator('[data-genre="五言绝句"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator(".work-list")).toContainText("五言绝句");
  await page.locator(".source-note summary").click();
  await expect(page.locator(".source-note")).toContainText("366");
  await expect(page.locator(".source-note a").last()).toHaveAttribute(
    "href",
    "./data/tang-poems.LICENSE",
  );
});
test("poem search by author, title and verse; line layout and navigation", async ({
  page,
}, testInfo) => {
  await poems(page);
  await page.locator("#search").fill("李白");
  await expect(page.locator(".work-list li").first()).toContainText("李白");
  await page.locator("#search").fill("疑是地上霜");
  await expect(page.locator(".work-list li")).toHaveCount(1);
  await page.locator(".work-link").click();
  await expect(page.locator(".poem-title")).toHaveText("静夜思");
  await expect(page.locator(".poem-author")).toContainText("李白");
  await expect(page.locator(".poem-line")).toHaveCount(2);
  await expect(page.locator("#notesBtn")).toBeVisible();
  await expect(page.locator("#transBtn")).toBeVisible();
  await page.locator("#dirBtn").click();
  await expect(page.locator("#reader")).toHaveClass(/vertical/);
  await expect(page.locator(".poem-title")).toBeVisible();
  await page.locator("#plusBtn").click();
  await page.locator("#search").fill("春眠不觉晓");
  await expect(page.locator(".work-list")).toContainText("春晓");
  await page.locator("#clearSearch").click();
  await expect(page.locator(".poem-title")).toHaveText("静夜思");
  await page.locator(".reading-pagination a").last().click();
  await expect(page.locator(".poem-title")).not.toHaveText("静夜思");
  await page.goBack();
  await expect(page.locator(".poem-title")).toHaveText("静夜思");
});
test("legacy link and reading position migrate without colliding with poetry", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "ssxy_pos",
      JSON.stringify({ 德行: { entry: 20, offset: 0, atStart: false } }),
    );
  });
  await page.goto("#/chapter/" + encodeURIComponent("德行"));
  await expect(page).toHaveURL(/book\/shishuo-xinyu\/read\/chapter-01/);
  await expect(page.locator(".chapter-title")).toContainText("德行");
  await expect
    .poll(() =>
      page.evaluate(() => {
        const top =
          document.querySelector("#reader").getBoundingClientRect().top + 20;
        return [...document.querySelectorAll("[data-entry]")].find(
          (el) => el.getBoundingClientRect().bottom > top,
        )?.dataset.entry;
      }),
    )
    .toBe("20");
  await page.locator("#plusBtn").click();
  await page.waitForTimeout(200);
  await page.goto("#/book/tang-poems/read/" + poemId);
  await expect(page.locator(".poem-title")).toHaveText("静夜思");
  await page.reload();
  await expect(page.locator(".poem-title")).toHaveText("静夜思");
  await page.locator("#homeBtn").click();
  await expect(page.locator(".library-intro")).toBeVisible();
  await expect(page.locator(".resume-link")).toContainText("唐诗选读");
  await page.goto("#/book/shishuo-xinyu/read/chapter-01");
  await expect(page.locator(".chapter-title")).toContainText("德行");
});
test("failed poetry load can retry while the other book remains accessible", async ({
  page,
}) => {
  let fail = true;
  await page.route("**/data/tang-poems.json", (r) =>
    fail ? r.abort() : r.continue(),
  );
  await page.goto("#/book/tang-poems");
  await expect(page.locator("#retryBook")).toBeVisible();
  fail = false;
  await page.locator("#retryBook").click();
  await expect(page.locator(".collection-header h1")).toHaveText("唐诗选读");
  await page.locator("#search").fill("zzzzzz");
  await expect(page.locator(".empty")).toContainText("未找到");
  await page.locator("#clearSearch").click();
  await expect(page.locator(".work-list li")).toHaveCount(40);
  await page.goto("#/book/does-not-exist");
  await expect(page.locator(".empty")).toContainText("未找到");
  await page.locator("#homeBtn").click();
  await expect(page.locator(".book-card")).toHaveCount(3);
});
test("book-switch races discard stale annotation failures", async ({
  page,
}) => {
  let release;
  const pending = new Promise((r) => (release = r));
  await page.route("**/data/liuxiaobiao-notes.json", async (route) => {
    await pending;
    await route.abort();
  });
  await page.goto("#/book/shishuo-xinyu");
  await expect(page.locator("#startBtn")).toBeVisible();
  await page.locator("#homeBtn").click();
  await page.locator('.book-card[href="#/book/tang-poems"]').click();
  await expect(page.locator(".collection-header h1")).toHaveText("唐诗选读");
  release();
  await expect(page.locator("#loadStatus")).toBeEmpty();
  await page.locator("#startBtn").click();
  await expect(page.locator(".poem-title")).toBeVisible();
});
test("library and poetry remain usable on narrow viewports and themes", async ({
  page,
}, testInfo) => {
  await page.goto("");
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-library.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.locator("#themeBtn").click();
  await page.goto("#/book/tang-poems/read/" + poemId);
  await expect(page.locator(".poem-title")).toBeVisible();
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-poem.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  if (testInfo.project.name === "mobile") {
    await page.locator("#menuBtn").click();
    await expect(page.locator("#side")).toHaveClass(/open/);
    await page.keyboard.press("Escape");
    await expect(page.locator("#menuBtn")).toBeFocused();
  }
});
test("a late book response cannot replace the book chosen afterwards", async ({
  page,
}) => {
  let release;
  const pending = new Promise((r) => (release = r));
  await page.route("**/data/tang-poems.json", async (route) => {
    await pending;
    await route.continue();
  });
  await page.goto("#/book/tang-poems");
  await expect(page.locator("#content")).toContainText("正在打开");
  await page.locator("#homeBtn").click();
  await page.locator(".book-card.prose").click();
  await expect(page.locator(".collection-header h1")).toHaveText("世说新语");
  release();
  await page.locator("#startBtn").click();
  await expect(page.locator(".chapter-title")).toContainText("德行");
  await expect(page.locator(".poem-title")).toHaveCount(0);
});
test("a failed catalog has explicit recovery and no silent blank screen", async ({
  page,
}) => {
  await page.route("**/data/catalog.json", (r) => r.abort());
  await page.goto("");
  await expect(page.locator("#retryCatalog")).toBeVisible();
  await page.unroute("**/data/catalog.json");
  await page.locator("#retryCatalog").click();
  await expect(page.locator(".book-card")).toHaveCount(3);
});
test("vertical poems and long titles fit within the reading viewport", async ({
  page,
}, testInfo) => {
  await page.goto("#/book/tang-poems/read/" + poemId);
  await expect(page.locator(".poem-title")).toBeVisible();
  await page.locator("#dirBtn").click();
  await expect(page.locator("#reader")).toHaveClass(/vertical/);
  await expect(page.locator(".poem-line").first()).toBeInViewport();
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-poem-vertical.png`,
    fullPage: true,
  });
});

test("overview uses one directory and restores reading navigation", async ({
  page,
}, info) => {
  await page.goto("#/book/tang-poems");
  await expect(page.locator(".work-list")).toBeVisible();
  await expect(page.locator("#side")).toBeHidden();
  await expect(page.locator("#menuBtn")).toBeHidden();
  await page.screenshot({
    path: `test-results/${info.project.name}-single-directory.png`,
    fullPage: true,
  });
  await page.locator("#startBtn").click();
  await expect(page.locator(".poem-title")).toBeVisible();
  await expect(page.locator("#side")).not.toHaveAttribute("hidden", "");
  if (info.project.name === "mobile") {
    await expect(page.locator("#menuBtn")).toBeVisible();
    await page.locator("#menuBtn").click();
    await expect(page.locator("#side")).toHaveClass(/open/);
  } else await expect(page.locator("#side")).toBeVisible();
  await page.locator("#bookNav a").last().click();
  await expect(page.locator("#side")).toBeHidden();
  await expect(page.locator("#scrim")).not.toHaveClass(/show/);
  await page.locator("#search").fill("李白");
  await expect(page.locator(".work-list li").first()).toContainText("李白");
  await expect(page.locator("#side")).toBeHidden();
  await page.locator("#clearSearch").click();
  await page.goto("#/book/shishuo-xinyu");
  await expect(page.locator(".work-list")).toBeVisible();
  await expect(page.locator("#side")).toBeHidden();
  await page.locator("#startBtn").click();
  await expect(page.locator(".chapter-title")).toContainText("德行");
  if (info.project.name === "mobile") {
    await page.locator("#menuBtn").click();
    await expect(page.locator("#side")).toHaveClass(/open/);
  } else await expect(page.locator("#side")).toBeVisible();
});

test("home icon is the sole home entry across collection, reading and atlas", async ({
  page,
}) => {
  for (const hash of [
    "#/book/tang-poems",
    "#/book/shishuo-xinyu/read/chapter-01",
    "#/atlas",
  ]) {
    await page.goto(hash);
    await expect(page.locator("#homeBtn")).toBeVisible();
    await expect(page.locator('a[href="#/"]')).toHaveCount(0);
  }
  await page.locator("#homeBtn").click();
  await expect(page.locator(".library-intro")).toBeVisible();
});

test("quiet directory reveals previews for search and offers one resume action", async ({
  page,
}) => {
  await poems(page);
  await expect(page.locator(".work-preview")).toHaveCount(0);
  await page.locator("#search").fill("南冠");
  await expect(page.locator(".work-preview")).toContainText("南冠");
  await page.locator(".work-link").click();
  await expect(page.locator(".entry").first()).toBeVisible();
  await page.locator("#homeBtn").click();
  await page.locator('.book-card[href="#/book/tang-poems"]').click();
  await expect(page.locator("#startBtn")).toContainText("继续阅读");
  await expect(page.locator(".collection-actions a")).toHaveCount(0);
  await page.locator("#startBtn").click();
  await expect(page.locator(".poem-title")).toHaveText("在岳咏蝉");
  const bounds = await page.locator(".tools").boundingBox();
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(
    page.viewportSize().width,
  );
});
