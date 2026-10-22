import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { compileDaxue, digest } from "./build-daxue.mjs";
import {
  validateProse,
  verifyProseHashes,
} from "../assets/prose-translations.mjs";
const read = async (p) => JSON.parse(await readFile(p, "utf8"));
const book = await read("data/daxue.json"),
  study = await read("data/daxue-study.json");
const expected = await compileDaxue();
assert.deepEqual(book, expected.book);
assert.deepEqual(study, expected.study);
validateProse(study, book.articles, "daxue");
await verifyProseHashes(study);
assert.equal(book.articles.length, 16);
assert.equal(Object.keys(study.entries).length, 16);
for (const e of Object.values(study.entries)) {
  assert(e.notes.length);
  assert.equal(e.sourceHash, digest(e.source));
  assert.notEqual(e.source, e.translation);
  assert(!/待补|TODO|暂无译文/u.test(e.translation));
}
assert.match(book.articles[0].content[0], /在亲民/);
assert(!book.articles.some((w) => w.content[0].includes("所谓致知在格物者")));
console.log(
  "大学 verified: 16 complete sections, " +
    Object.values(study.entries).reduce((n, e) => n + e.notes.length, 0) +
    " located notes, source and draft hashes valid.",
);
