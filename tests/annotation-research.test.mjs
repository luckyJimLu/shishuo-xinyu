import test from "node:test";
import assert from "node:assert/strict";
import {
  annotationResearch,
  annotationResearchLinks,
} from "../assets/annotation-research.mjs";
import { relatedWorks, atlasRoute } from "../assets/knowledge.mjs";
import { parseRoute } from "../assets/library.mjs";
test("plant and object annotation links are encoded Google image queries", () => {
  for (const note of [
    { word: "茱萸", note: "古人重阳佩戴的植物。" },
    { word: "金猊", note: "狮形香炉。" },
    { word: "芙蓉", note: "这里指荷花。" },
  ]) {
    const r = annotationResearch(note),
      u = new URL(r.url);
    assert.equal(u.hostname, "www.google.com");
    assert.equal(u.searchParams.get("tbm"), "isch");
    assert.equal(u.searchParams.get("q"), r.query);
  }
  assert.match(
    annotationResearch({ word: "茱萸", note: "植物" }).query,
    /吴茱萸/,
  );
  assert.match(
    annotationResearch({ word: "芙蓉", note: "指木芙蓉。" }).query,
    /木芙蓉/,
  );
  assert.equal(
    annotationResearchLinks([
      { word: "茱萸", note: "植物" },
      { word: "红萸", note: "茱萸" },
    ]).length,
    1,
  );
});
test("homographs and nonphysical meanings never get unrelated image links", () => {
  for (const n of [
    { word: "玉壶", note: "借指月亮。" },
    { word: "红衣", note: "穿红衣的女子。" },
    { word: "黄花", note: "某个人名。" },
    { word: "心字", note: "心形纹样。" },
    { word: "履", note: "履行职事。" },
    { word: "长安", note: "京城的借称。" },
    { word: "琴赋", note: "作品名。" },
    { word: "如意", note: "符合心愿。" },
    { word: "角", note: "角落。" },
    { word: "尊", note: "尊贵。" },
  ])
    assert.equal(annotationResearch(n), null, n.word);
});
test("place work lists group by stable book and work ids and reject candidates", () => {
  const base = {
    status: "reviewed",
    bookId: "a",
    workId: "1",
    bookTitle: "甲",
    title: "同题",
  };
  const rows = relatedWorks([
    { ...base, id: "m1" },
    { ...base, id: "m2" },
    { ...base, workId: "2", id: "m3" },
    { ...base, bookId: "b", id: "m4" },
    { ...base, workId: "3", status: "candidate" },
  ]);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].mentions.length, 2);
  const url = atlasRoute({ view: "list", place: "yangzhou", book: "song-ci" });
  assert.equal(parseRoute(url).filters.view, "list");
  assert.equal(parseRoute(url).filters.book, "song-ci");
});
