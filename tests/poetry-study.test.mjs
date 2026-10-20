import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  studyLine,
  validateStudy,
  verifyStudyHashes,
} from "../assets/poetry-study.mjs";
import { mergedSpans } from "../assets/knowledge.mjs";
const book = JSON.parse(await readFile("data/tang-poems.json", "utf8"));
const data = JSON.parse(await readFile("data/tang-poems-study.json", "utf8"));
test("all 366 poems have exact aligned original translations and notes", async () => {
  assert.equal(
    Object.keys(validateStudy(data, book.articles).poems).length,
    366,
  );
  assert.equal(Object.values(data.poems).flatMap((p) => p.lines).length, 1751);
  await verifyStudyHashes(data);
});
test("homonymous titles and semantic variants do not share the wrong text", () => {
  const suigong = book.articles.filter((p) => p.title === "隋宫");
  assert.equal(suigong.length, 2);
  assert.notEqual(
    studyLine(data, suigong[0], 0).translation,
    studyLine(data, suigong[1], 0).translation,
  );
  const a = book.articles[122],
    b = book.articles[337];
  assert.match(studyLine(data, a, 1).translation, /不与秦/);
  assert.match(studyLine(data, b, 1).translation, /才与秦/);
  assert.match(studyLine(data, book.articles[279], 0).translation, /渔人/);
});
test("changed source, unreviewed drafts and invalid offsets are never rendered", () => {
  const work = book.articles[0];
  assert.equal(studyLine(data, { ...work, content: ["改变了原文"] }, 0), null);
  for (const mutate of [
    (p) => (p.status = "draft"),
    (p) => (p.lines[0].status = "pending"),
    (p) => (p.lines[0].notes[0].start = 999),
    (p) => (p.lines[0].translation = null),
  ]) {
    const copy = structuredClone(data);
    mutate(copy.poems[work.id]);
    assert.equal(studyLine(copy, work, 0), null);
    assert.throws(() => validateStudy(copy, book.articles));
  }
});
test("source fingerprints are verified before publishing or loading", async () => {
  const copy = structuredClone(data);
  copy.poems[book.articles[0].id].lines[0].sourceHash = "0".repeat(64);
  await assert.rejects(verifyStudyHashes(copy), /指纹失效/);
});
test("explicit annotation offsets distinguish repeated terms and merge with places", () => {
  const text = "长安又望长安";
  const notes = [{ word: "长安", start: 4, end: 6, note: "第二处" }];
  const result = mergedSpans(text, notes, [{ start: 4, end: 6, id: "place" }]);
  assert.equal(result.length, 1);
  assert.equal(result[0].start, 4);
  assert.equal(result[0].notes[0].note, "第二处");
  assert.equal(result[0].mentions[0].id, "place");
});
