import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
const { articles } = JSON.parse(await readFile("data/tang-poems.json", "utf8"));
const study = JSON.parse(await readFile("data/tang-poems-study.json", "utf8"));
const route = (i) => "#/book/tang-poems/read/" + articles[i].id;
test("poetry annotations and complete line translations are opt-in and persist", async ({
  page,
}) => {
  await page.goto(route(0));
  await expect(page.locator("#notesBtn")).toBeVisible();
  await expect(page.locator(".translation")).toHaveCount(0);
  await expect(page.locator(".annotated")).toHaveCount(0);
  await page.locator("#transBtn").click();
  await expect(page.locator(".translation")).toHaveCount(4);
  await expect(page.locator(".translation").first()).toContainText("囚居的人");
  await page.locator("#notesBtn").click();
  const note = page.locator(".annotated").filter({ hasText: "南冠" });
  await note.click();
  await expect(page.locator(".note-pop:not([hidden])")).toContainText("囚徒");
  await page.locator(".study-sources summary").click();
  await expect(page.locator(".study-sources")).toContainText(
    "未经过独立专家审校",
  );
  await expect(page.locator(".study-sources a").first()).toHaveAttribute(
    "rel",
    "noopener noreferrer",
  );
  await page.reload();
  await expect(page.locator("#transBtn")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator(".translation")).toHaveCount(4);
  await page.goto(route(177));
  await expect(page.locator(".translation")).toHaveCount(60);
  await expect(page.locator(".translation").last()).toContainText("绵延无绝期");
});
test("same-title works and opposite variants keep their own study text", async ({
  page,
}) => {
  await page.goto(route(16));
  await page.locator("#transBtn").click();
  await expect(page.locator(".translation")).toHaveCount(4);
  await expect(page.locator(".translation").first()).toContainText("扬州");
  await page.goto(route(21));
  await expect(page.locator(".translation")).toHaveCount(2);
  await expect(page.locator(".translation").first()).toContainText("南游");
  await page.goto(route(337));
  await expect(page.locator(".translation").nth(1)).toContainText("才与秦地");
});
test("poetry word notes merge with research cards and restore keyboard focus", async ({
  page,
}, info) => {
  await page.goto(route(171));
  await page.locator("#notesBtn").click();
  await page.locator("#knowledgeBtn").click();
  const word = page.getByRole("button", {
    name: "玉壶，器物研读",
    exact: true,
  });
  await expect(word).toHaveCount(1);
  await word.click();
  const panel = page.locator(
    info.project.name === "mobile" ? "#researchDialog" : "#researchPanel",
  );
  await expect(panel).toContainText("人格高洁");
  await expect(
    panel.getByRole("link", { name: /Google 图片/ }),
  ).toHaveAttribute("href", /tbm=isch/);
  if (info.project.name === "mobile") await page.keyboard.press("Escape");
  else await panel.getByRole("button", { name: "关闭名物研读" }).click();
  await expect(word).toBeFocused();
});
test("study failures and invalid fingerprints hide auxiliary text with recovery", async ({
  page,
}) => {
  let mode = "fail";
  await page.route("**/data/tang-poems-study.json", (r) => {
    if (mode === "fail") return r.abort();
    if (mode === "corrupt") {
      const bad = structuredClone(study);
      bad.poems[articles[0].id].lines[0].sourceHash = "0".repeat(64);
      return r.fulfill({ json: bad });
    }
    return r.continue();
  });
  await page.goto(route(0));
  await page.locator("#transBtn").click();
  await expect(page.locator("#retryOptional")).toBeVisible();
  await expect(page.locator(".poem-line").first()).toContainText("西陆蝉声唱");
  await expect(page.locator(".translation")).toHaveCount(0);
  mode = "corrupt";
  await page.locator("#retryOptional").click();
  await expect(page.locator("#retryOptional")).toBeEnabled();
  await expect(page.locator(".translation")).toHaveCount(0);
  mode = "ok";
  await page.locator("#retryOptional").click();
  await expect(page.locator(".translation")).toHaveCount(4);
});
test("slow study loads cannot replace prose and loading is announced", async ({
  page,
}) => {
  let release;
  const pending = new Promise((r) => (release = r));
  await page.route("**/data/tang-poems-study.json", async (r) => {
    await pending;
    await r.continue();
  });
  await page.goto(route(0));
  await page.locator("#transBtn").click();
  await expect(page.locator("#loadStatus")).toContainText("正在加载唐诗注译");
  await expect(page.locator(".poem-line")).toHaveCount(4);
  await page.goto("#/book/shishuo-xinyu/read/chapter-01");
  release();
  await expect(page.locator(".translation").first()).toContainText("陈仲举");
  await expect(page.locator("#loadStatus")).toBeEmpty();
  await expect(page.locator(".study-sources")).toHaveCount(1);
  await expect(page.locator(".study-sources summary")).toHaveText(
    "译文说明与参考资料",
  );
  await expect(page.locator(".translation")).toHaveCount(47);
});
test("study layout works in both directions, search, dark and narrow views", async ({
  page,
}, info) => {
  await page.goto(route(0));
  await page.locator("#transBtn").click();
  await page.locator("#notesBtn").click();
  await expect(page.locator(".translation")).toHaveCount(4);
  await page.screenshot({
    path: `test-results/${info.project.name}-poetry-study.png`,
    fullPage: true,
  });
  await page.locator("#search").fill("南冠");
  await expect(page.locator(".work-list li")).toHaveCount(1);
  await expect(page.locator(".work-preview")).toContainText("南冠");
  await page.locator("#clearSearch").click();
  await expect(page.locator(".translation")).toHaveCount(4);
  await page.locator("#themeBtn").click();
  await page.locator("#dirBtn").click();
  await expect(page.locator("#reader")).toHaveClass(/vertical/);
  await page.locator(".study-sources summary").scrollIntoViewIfNeeded();
  await page.locator(".study-sources summary").click();
  await expect(page.locator(".study-sources")).toContainText(
    "模型辅助原创整理",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/${info.project.name}-poetry-study-vertical.png`,
    fullPage: true,
  });
});

test("long poem reading position survives annotation and translation switches", async ({
  page,
}) => {
  await page.goto(route(177));
  await page.locator("#transBtn").click();
  await expect(page.locator(".translation")).toHaveCount(60);
  await page.locator('[data-entry="30"]').scrollIntoViewIfNeeded();
  const anchor = () =>
    page.evaluate(() => {
      const top =
        document.querySelector("#reader").getBoundingClientRect().top + 20;
      return [...document.querySelectorAll("[data-entry]")].find(
        (e) => e.getBoundingClientRect().bottom > top,
      )?.dataset.entry;
    });
  const before = await anchor();
  await page.locator("#notesBtn").click();
  await expect.poll(anchor).toBe(before);
  await page.locator("#transBtn").click();
  await expect(page.locator(".translation")).toHaveCount(0);
  await expect.poll(anchor).toBe(before);
  await page.locator("#transBtn").click();
  await expect(page.locator(".translation")).toHaveCount(60);
  await expect.poll(anchor).toBe(before);
});
