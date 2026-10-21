import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  studyLine,
  validateStudy,
  verifyStudyHashes,
} from "../assets/poetry-study.mjs";
import { compileSongStudy } from "../scripts/build-song-study.mjs";
const read = async (p) => JSON.parse(await readFile(p, "utf8"));
const works = (await read("data/song-ci.json")).articles;
const data = await read("data/song-ci-study.json");
test("all 280 Song ci have 2562 aligned translations and reproducible reviewed drafts", async () => {
  validateStudy(data, works, "song-ci");
  await verifyStudyHashes(data);
  assert.equal(Object.values(data.poems).flatMap((p) => p.lines).length, 2562);
  assert.deepEqual(data, await compileSongStudy());
});
test("Song variants, duplicate attributions and missing characters keep distinct readings", () => {
  assert.match(studyLine(data, works[16], 6).translation, /杨花/);
  assert.match(studyLine(data, works[18], 6).translation, /梨花/);
  assert.match(studyLine(data, works[41], 3).translation, /枫叶/);
  assert.match(data.poems[works[208].id].remarks, /缺字/);
  assert.notEqual(works[262].id, works[266].id);
  assert.equal(data.poems[works[50].id].author, "韩");
});
test("wrong book, changed title, pending lines and invalid ranges fail closed", () => {
  assert.throws(() => validateStudy(data, works));
  assert.equal(studyLine(data, { ...works[0], title: "错配标题" }, 0), null);
  for (const mutate of [
    (p) => (p.lines[0].status = "pending"),
    (p) => (p.lines[0].translation = ""),
    (p) => (p.lines.find((line) => line.notes.length).notes[0].start = 999),
  ]) {
    const bad = structuredClone(data);
    mutate(bad.poems[works[0].id]);
    assert.throws(() => validateStudy(bad, works, "song-ci"));
  }
});
test("Song source hashes catch otherwise matching content metadata", async () => {
  const bad = structuredClone(data);
  bad.poems[works[38].id].lines[0].sourceHash = "0".repeat(64);
  await assert.rejects(verifyStudyHashes(bad), /指纹失效/);
});
