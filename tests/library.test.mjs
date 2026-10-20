import test from "node:test";
import assert from "node:assert/strict";
import {
  validateCatalog,
  adaptBook,
  findWorks,
  parseRoute,
  readingRoute,
  storageKey,
} from "../assets/library.mjs";
test("catalog rejects unsafe or duplicate book ids and paths", () => {
  const b = {
    id: "poems",
    title: "唐诗",
    kind: "poetry",
    path: "tang-poems.json",
  };
  assert.equal(validateCatalog({ books: [b] }).length, 1);
  assert.throws(() => validateCatalog({ books: [b, b] }));
  assert.throws(() =>
    validateCatalog({ books: [{ ...b, path: "../secret.json" }] }),
  );
});
test("book adapter retains stable poem ids and rejects ambiguous entries", () => {
  const meta = { kind: "poetry" },
    work = {
      id: "a",
      title: "山中",
      author: "王维",
      content: ["山路元无雨，空翠湿人衣。"],
    };
  const data = adaptBook(meta, {
    articles: [work, { ...work, id: "b", author: "王勃" }],
  });
  assert.equal(data[1].id, "b");
  assert.throws(() => adaptBook(meta, { articles: [work, work] }));
  assert.throws(() =>
    adaptBook(meta, { articles: [{ ...work, content: [""] }] }),
  );
  assert.equal(
    adaptBook(
      { kind: "prose" },
      { articles: [{ title: "德行", content: ["正文"] }] },
    )[0].id,
    "chapter-01",
  );
});
test("poetry search covers titles, authors and complete verses", () => {
  const poems = [
    {
      title: "静夜思",
      author: "李白",
      genre: "五言绝句",
      content: ["床前明月光，疑是地上霜。"],
    },
    { title: "春晓", author: "孟浩然", content: ["春眠不觉晓。"] },
  ];
  for (const q of ["静夜", "李白", "明月光"])
    assert.equal(findWorks(poems, q)[0].work.title, "静夜思");
  assert.equal(findWorks(poems, "  ").length, 2);
  assert.equal(findWorks(poems, "杜甫").length, 0);
});
test("book routes round-trip and legacy links remain recognizable", () => {
  assert.deepEqual(parseRoute(readingRoute("poems", "诗-1")), {
    view: "reading",
    bookId: "poems",
    workId: "诗-1",
  });
  assert.equal(
    parseRoute("#/chapter/" + encodeURIComponent("德行")).view,
    "legacy",
  );
  assert.equal(parseRoute("#/chapter/%invalid").view, "missing");
  assert.equal(parseRoute("").view, "library");
  assert.notEqual(
    storageKey("poems", "positions"),
    storageKey("shishuo-xinyu", "positions"),
  );
});
