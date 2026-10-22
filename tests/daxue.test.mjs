import test from "node:test";
import assert from "node:assert/strict";
import { compileDaxue } from "../scripts/build-daxue.mjs";
import {
  validateProse,
  proseEntry,
  verifyProseHashes,
} from "../assets/prose-translations.mjs";
const { book, study } = await compileDaxue();
test("Daxue sixteen paragraphs and 97 notes preserve exact reviewed source", async () => {
  assert.equal(book.articles.length, 16);
  assert.equal(
    Object.values(study.entries).reduce((n, e) => n + e.notes.length, 0),
    97,
  );
  validateProse(study, book.articles, "daxue");
  await verifyProseHashes(study);
  assert.match(book.articles[0].content[0], /在亲民/);
  for (const e of Object.values(study.entries))
    for (const n of e.notes)
      assert.equal(e.source.slice(n.start, n.end), n.word);
});
test("Daxue wrong-book, changed text, invalid notes and hashes fail closed", async () => {
  assert.throws(() => validateProse(study, book.articles));
  assert.equal(
    proseEntry(study, { ...book.articles[0], content: ["改动原文"] }, 0),
    null,
  );
  for (const mutate of [
    (e) => (e.translation = ""),
    (e) => (e.segments[0].status = "pending"),
    (e) => (e.notes[0].start = 9999),
  ]) {
    const bad = structuredClone(study);
    mutate(bad.entries["chapter-01:1"]);
    assert.throws(() => validateProse(bad, book.articles, "daxue"));
  }
  const bad = structuredClone(study);
  bad.entries["chapter-01:1"].sourceHash = "0".repeat(64);
  await assert.rejects(verifyProseHashes(bad), /指纹失效/);
});
