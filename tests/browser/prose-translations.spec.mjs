import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
const data = JSON.parse(
  await readFile("data/shishuo-translations.json", "utf8"),
);
const poems = JSON.parse(
  await readFile("data/tang-poems.json", "utf8"),
).articles;
const path = (n) =>
  `#/book/shishuo-xinyu/read/chapter-${String(n).padStart(2, "0")}`;
test("all prose translations are opt-in, persist and cover the final chapter", async ({
  page,
}) => {
  await page.goto(path(1));
  await expect(page.locator(".translation")).toHaveCount(0);
  await page.locator("#transBtn").click();
  await expect(page.locator(".translation")).toHaveCount(47);
  await expect(page.locator(".translation").last()).toContainText(
    "小吴后来显贵",
  );
  await expect(page.locator(".annotated")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".translation")).toHaveCount(47);
  await page.goto(path(36));
  await expect(page.locator(".translation")).toHaveCount(8);
  await expect(page.locator(".translation").last()).toContainText("不忍");
  await page.getByText("译文说明与参考资料", { exact: true }).click();
  await expect(page.locator(".study-sources[open]")).toContainText(
    "未经过独立专家审校",
  );
});
test("prose failures, source mismatch and bad hashes preserve body and offer recovery", async ({
  page,
}) => {
  let mode = "fail";
  await page.route("**/data/shishuo-translations.json", (r) => {
    if (mode === "fail") return r.abort();
    if (mode === "ok") return r.continue();
    const bad = structuredClone(data);
    if (mode === "source") bad.entries["chapter-01:1"].source += "改";
    else bad.entries["chapter-01:1"].sourceHash = "0".repeat(64);
    return r.fulfill({ json: bad });
  });
  await page.goto(path(1));
  await page.locator("#transBtn").click();
  for (const next of ["source", "hash", "ok"]) {
    await expect(page.locator("#retryOptional")).toBeEnabled();
    await expect(page.locator(".translation")).toHaveCount(0);
    await expect(page.locator(".entry").first()).toContainText("陈仲举");
    mode = next;
    await page.locator("#retryOptional").click();
  }
  await expect(page.locator(".translation")).toHaveCount(47);
});
test("late prose response cannot replace active poetry", async ({ page }) => {
  let release;
  const held = new Promise((resolve) => (release = resolve));
  await page.route("**/data/shishuo-translations.json", async (r) => {
    await held;
    await r.fulfill({ json: data });
  });
  await page.goto(path(1));
  await page.locator("#transBtn").click();
  await expect(page.locator("#loadStatus")).toContainText("正在加载正文译文");
  await page.evaluate(
    (hash) => (location.hash = hash),
    `#/book/tang-poems/read/${poems[0].id}`,
  );
  await expect(page.locator(".translation")).toHaveCount(4);
  release();
  await expect(page.locator(".translation").first()).toContainText("囚居的人");
  await expect(page.locator(".chapter-title")).toContainText("在岳咏蝉");
});
test("translation toggles retain long-chapter position in both orientations and search", async ({
  page,
}) => {
  await page.goto(path(2));
  await expect(page.locator("#loadStatus")).toBeEmpty();
  const move = () =>
    page.evaluate(() => {
      const r = document.querySelector("#reader"),
        e = document.querySelector('[data-entry="70"]'),
        b = e.getBoundingClientRect(),
        v = r.classList.contains("vertical"),
        a = r.getBoundingClientRect();
      r.scrollBy({
        top: v ? 0 : b.top - a.top - 20,
        left: v ? b.right - a.right + 20 : 0,
        behavior: "instant",
      });
    });
  const anchor = () =>
    page.evaluate(() => {
      const r = document.querySelector("#reader"),
        a = r.getBoundingClientRect(),
        v = r.classList.contains("vertical"),
        ref = v ? a.right - 20 : a.top + 20;
      return [...document.querySelectorAll("[data-entry]")].find((e) => {
        const b = e.getBoundingClientRect();
        return v
          ? b.left < ref && b.right > a.left
          : b.bottom > ref && b.top < a.bottom;
      })?.dataset.entry;
    });
  for (let n = 0; n < 2; n++) {
    await move();
    await expect.poll(anchor).toBe("70");
    await page.locator("#transBtn").click();
    await expect.poll(anchor).toBe("70");
    if (!n) await page.locator("#dirBtn").click();
  }
  await page.locator("#search").fill("羊叔子");
  await expect(page.locator("[data-entry]")).toHaveCount(1);
  await page.locator("#transBtn").click();
  await expect(page.locator(".translation")).toContainText("羊祜");
  await page.getByRole("button", { name: "清除检索" }).click();
  await expect(page.locator(".translation")).toHaveCount(108);
});
