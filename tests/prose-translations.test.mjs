import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  proseEntry,
  validateProse,
  verifyProseHashes,
} from "../assets/prose-translations.mjs";
import {
  compileProse,
  proseWorks,
} from "../scripts/build-prose-translations.mjs";
const read = async (p) => JSON.parse(await readFile(p, "utf8"));
const works = proseWorks(await read("data/shishuo-xinyu.json")),
  data = await read("data/shishuo-translations.json");
test("all 1128 stories retain source, contiguous segments and generated compatibility", async () => {
  validateProse(data, works);
  await verifyProseHashes(data);
  assert.equal(Object.keys(data.entries).length, 1128);
  const c = await compileProse();
  assert.deepEqual(c.resource, data);
  assert.deepEqual(c.compatibility, await read("data/translations.json"));
});
test("changed source, reordered entries, pending segments and missing meanings fail closed", () => {
  const w = works[0];
  assert.equal(
    proseEntry(data, { ...w, content: [w.content[1], w.content[0]] }, 0),
    null,
  );
  for (const change of [
    (e) => (e.status = "draft"),
    (e) => (e.translation = ""),
    (e) => (e.segments[0].status = "pending"),
    (e) => e.segments.pop(),
    (e) => (e.segments[0].source += "错"),
    (e) => (e.segments[0].translation = "漏句"),
  ]) {
    const bad = structuredClone(data);
    change(bad.entries[`${w.id}:1`]);
    assert.equal(proseEntry(bad, w, 0), null);
    assert.throws(() => validateProse(bad, works));
  }
});
test("fingerprints catch otherwise valid-looking metadata", async () => {
  const bad = structuredClone(data);
  bad.entries["chapter-01:1"].sourceHash = "0".repeat(64);
  await assert.rejects(verifyProseHashes(bad), /指纹失效/);
});
test("merged source stories and narrative endings are not discarded", () => {
  const e = proseEntry(data, works[19], 6);
  assert.match(e.source, /8王丞相/);
  assert.match(e.translation, /郭/);
  assert.match(e.translation, /柏/);
  const another = proseEntry(data, works[23], 5);
  assert.match(another.translation, /王澄/);
  assert.match(another.translation, /高坐道人/);
  assert.match(proseEntry(data, works[35], 7).translation, /不忍/);
});
