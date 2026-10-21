import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { read, compileProse, proseWorks } from "./build-prose-translations.mjs";
import { compileStudy, digest } from "./build-tang-study.mjs";
import {
  proseEntry,
  validateProse,
  verifyProseHashes,
} from "../assets/prose-translations.mjs";
import {
  studyLine,
  validateStudy,
  verifyStudyHashes,
} from "../assets/poetry-study.mjs";
const prose = await read("data/shishuo-translations.json"),
  poems = await read("data/tang-poems-study.json");
const pw = proseWorks(await read("data/shishuo-xinyu.json")),
  tw = (await read("data/tang-poems.json")).articles;
const audit = await read("sources/tang-poems/study/translation-audit.json");
const counts = () => ({
  total: 0,
  completed: 0,
  missing: 0,
  empty: 0,
  invalid: 0,
  pending: 0,
});
const books = [];
for (const [id, title, works, data, get] of [
  ["shishuo-xinyu", "世说新语", pw, prose, proseEntry],
  ["tang-poems", "唐诗选读", tw, poems, studyLine],
]) {
  const summary = counts(),
    chapters = [];
  for (const w of works) {
    const c = { id: w.id, title: w.title, ...counts() };
    w.content.forEach((source, i) => {
      c.total++;
      const e =
        id === "tang-poems"
          ? data.poems?.[w.id]?.lines?.[i]
          : data.entries?.[`${w.id}:${i + 1}`];
      let state;
      if (!e) state = "missing";
      else if (!e.translation?.trim()) state = "empty";
      else if (e.status !== "reviewed") state = "pending";
      else {
        const a = audit.entries?.[`${w.id}:${i + 1}`];
        const auditOK =
          id !== "tang-poems" ||
          (a?.status === "reviewed" &&
            a.sourceHash === digest(source) &&
            a.translationHash === digest(e.translation));
        state =
          get(data, w, i) && digest(source) === e.sourceHash && auditOK
            ? "completed"
            : "invalid";
      }
      c[state]++;
    });
    for (const k of Object.keys(summary)) summary[k] += c[k];
    chapters.push(c);
  }
  books.push({ id, title, summary, chapters });
}
const report = {
  schemaVersion: 1,
  scope: "两书正文；不含刘孝标注",
  reviewNote:
    "模型辅助原创整理与逐项自校。自动校验只证明绑定、结构及复核记录一致，不能证明译义准确；未经过独立专家审校。",
  books,
};
if (process.argv.includes("--write"))
  await writeFile(
    "data/translation-coverage.json",
    JSON.stringify(report, null, 2) + "\n",
  );
else
  assert.deepEqual(
    await read("data/translation-coverage.json"),
    report,
    "覆盖报告过期，请重新生成",
  );
for (const b of books) {
  console.log(`${b.title}: ${JSON.stringify(b.summary)}`);
  assert.equal(b.summary.completed, b.summary.total, "译文缺漏或需要复核");
}
assert.equal(books[0].summary.total, 1128);
assert.equal(books[1].summary.total, 1751);
validateProse(prose, pw);
await verifyProseHashes(prose);
validateStudy(poems, tw);
await verifyStudyHashes(poems);
const compiled = await compileProse();
assert.deepEqual(prose, compiled.resource, "正文译文与原稿不一致");
assert.deepEqual(
  await read("data/translations.json"),
  compiled.compatibility,
  "兼容译文输出过期",
);
assert.deepEqual(poems, await compileStudy(), "唐诗资源与原稿不一致");
assert.equal(Object.keys(audit.entries).length, 1751);
assert.equal(audit.independentExpertReview, false);
