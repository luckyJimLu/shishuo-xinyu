import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { compileSongStudy } from "./build-song-study.mjs";
import { validateStudy, verifyStudyHashes } from "../assets/poetry-study.mjs";
const read = async (p) => JSON.parse(await readFile(p, "utf8"));
const works = (await read("data/song-ci.json")).articles;
const data = await read("data/song-ci-study.json");
validateStudy(data, works, "song-ci");
await verifyStudyHashes(data);
assert.deepEqual(
  data,
  await compileSongStudy(),
  "宋词注译与原稿或自校记录不一致",
);
const poems = Object.values(data.poems),
  lines = poems.flatMap((p) => p.lines);
assert.equal(poems.length, 280);
assert.equal(lines.length, 2562);
for (const p of poems) {
  assert.equal(p.review.independentExpertReview, false);
  assert(p.review.checks.includes("句义与否定"));
  for (const line of p.lines) {
    assert(line.notes.length || line.noNoteReason);
    assert(line.translation.trim() && line.translation !== line.source);
    assert(!/TODO|待补|暂无译文/u.test(line.translation));
  }
}
console.log(
  `Song study verified: ${poems.length} works, ${lines.length} translations, ${lines.reduce((n, l) => n + l.notes.length, 0)} located notes.`,
);
