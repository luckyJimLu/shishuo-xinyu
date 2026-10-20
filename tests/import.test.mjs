import test from "node:test";
import assert from "node:assert/strict";
import {
  alignBook,
  chapterSources,
  extractNotes,
  normalize,
  stream,
} from "../scripts/liu-core.mjs";
const first = "陳仲舉言為士則";
test("missing start and malformed parentheses fail explicitly", () => {
  assert.throws(() => chapterSources("unrelated text"), /beginning/);
  assert.throws(() => stream("正文(未閉合"), /Unclosed/);
});
test("simplified/traditional mapping preserves matching and original notes", () => {
  const r = alignBook(
    [{ title: "德行", content: ["陈仲举言为士则，学而时习之。"] }],
    first + "(原注/前段)學而時習之(末注)",
  );
  assert.equal(r.summary.accepted, 1);
  assert.deepEqual(r.notes["德行:1"], ["前段原注", "末注"]);
  assert.equal(normalize("學，習。"), "学习");
});
test("failed and consecutive failed entries cannot donate their notes to a preceding entry", () => {
  const r = alignBook(
    [
      {
        title: "德行",
        content: [
          first,
          "缺失甲乙丙丁戊己庚辛",
          "缺失壬癸子丑寅卯辰巳",
          "第四則正文在此",
        ],
      },
    ],
    first +
      "(第一注)第二則別文(第二注)第三則別文(第三注)第四則正文在此(第四注)",
  );
  assert.deepEqual(r.notes["德行:1"], ["第一注"]);
  assert.deepEqual(r.notes["德行:4"], ["第四注"]);
  assert.equal(r.summary.failed, 2);
});
test("weak prefix alone never publishes a note", () => {
  const text = first + "甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥";
  const r = alignBook(
    [{ title: "德行", content: [text + "結尾完全不同"] }],
    text + "(不應刊出)其他結尾",
  );
  assert.equal(r.rows[0].status, "review");
  assert.deepEqual(r.notes, {});
});
test("chapter order and split chapter sections are respected", () => {
  const r = alignBook(
    [
      { title: "德行", content: [first] },
      { title: "言语", content: ["言語正文在此"] },
      { title: "政事", content: ["政事正文在此"] },
    ],
    first +
      "(首注)\n　政事第三\n政事正文在此(政注)\n　言語第二(上)\n言語正文在此(語注)",
  );
  assert.deepEqual(r.notes["言语:1"], ["語注"]);
  assert.deepEqual(r.notes["政事:1"], ["政注"]);
});
test("manual corrections survive regeneration and require evidence", () => {
  const correction = {
    "德行:1": { notes: ["校訂注"], reason: "影印本复核", reviewer: "tester" },
  };
  assert.deepEqual(
    alignBook(
      [{ title: "德行", content: [first] }],
      first + "(原注)",
      correction,
    ).notes["德行:1"],
    ["校訂注"],
  );
  assert.throws(
    () =>
      alignBook([{ title: "德行", content: [first] }], first, {
        "德行:1": { notes: [] },
      }),
    /Invalid correction/,
  );
});
test("nested note and two-column ordering", () =>
  assert.deepEqual(extractNotes("正文(後(內)段/前段)"), ["前段後(內)段"]));
