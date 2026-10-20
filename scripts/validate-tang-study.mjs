import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { compileStudy } from "./build-tang-study.mjs";
import { validateStudy, verifyStudyHashes } from "../assets/poetry-study.mjs";
const read = async (p) => JSON.parse(await readFile(p, "utf8"));
const book = await read("data/tang-poems.json");
const data = await read("data/tang-poems-study.json");
assert.equal(book.articles.length, 366);
validateStudy(data, book.articles);
await verifyStudyHashes(data);
assert.deepEqual(
  data,
  await compileStudy(),
  "注译资源与原稿或校读记录不一致，请重新生成",
);
const poems = Object.values(data.poems);
const lines = poems.flatMap((p) => p.lines);
for (const p of poems) {
  assert.equal(p.review.independentExpertReview, false);
  assert(p.review.checks.includes("句义与否定"));
  for (const l of p.lines) {
    assert.notEqual(l.translation, l.source, "译文不能照搬原句");
    assert(l.notes.length || l.noNoteReason, "未记录本行词注整理情况");
    assert(
      !/待补|TODO|暂无译文|此句描写|本句意思/.test(l.translation),
      "译文含占位文本",
    );
  }
}
console.log(
  `Tang study verified: ${poems.length} poems, ${lines.length} translations, ${lines.reduce((n, l) => n + l.notes.length, 0)} located word notes.`,
);
