import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  contextEntry,
  validateContext,
  verifyContextHashes,
} from "../assets/poetry-context.mjs";
import { compileContext } from "../scripts/build-poetry-context.mjs";
const read = async (p) => JSON.parse(await readFile(p, "utf8"));
const works = (await read("data/tang-poems.json")).articles,
  data = await read("data/tang-poems-context.json");
test("all 366 contexts bind the current title, author, verses and an exact quotation", async () => {
  validateContext(data, works);
  await verifyContextHashes(data);
  assert.deepEqual(data, await compileContext());
});
test("same-title poems, textual variants and conflicting author attributions remain distinct", () => {
  assert.match(contextEntry(data, works[16]).background, /炀帝/);
  assert.match(contextEntry(data, works[21]).background, /不纳谏/);
  assert.match(contextEntry(data, works[33]).background, /署李商隐/);
  assert.match(contextEntry(data, works[176]).background, /黄拱/);
  assert.match(contextEntry(data, works[361]).background, /春光/);
  assert.match(contextEntry(data, works[178]).background, /815/);
});
test("source changes, unreviewed entries and invented quotations fail closed", async () => {
  const w = works[0];
  assert.equal(contextEntry(data, { ...w, author: "改署作者" }), null);
  assert.equal(contextEntry(data, { ...w, content: ["改过的正文"] }), null);
  for (const change of [
    (e) => (e.status = "draft"),
    (e) => (e.mood = ""),
    (e) => (e.evidence = "不在诗里的话"),
    (e) => (e.id = "other"),
  ]) {
    const bad = structuredClone(data);
    change(bad.works[w.id]);
    assert.equal(contextEntry(bad, w), null);
    assert.throws(() => validateContext(bad, works));
  }
  const bad = structuredClone(data);
  bad.works[w.id].sourceHash = "0".repeat(64);
  await assert.rejects(verifyContextHashes(bad));
});
