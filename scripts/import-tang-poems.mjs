import { readFile, writeFile, copyFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import * as OpenCC from "opencc-js";
const root = "sources/tang-poems/";
const raw = await readFile(root + "tang300.original.json");
const source = JSON.parse(await readFile(root + "provenance.json", "utf8"));
assert.equal(
  createHash("sha256").update(raw).digest("hex"),
  source.sha256,
  "Tang source changed",
);
const convert = OpenCC.Converter({ from: "t", to: "cn" });
const genres = [
  "五言古诗",
  "七言古诗",
  "五言律诗",
  "七言律诗",
  "五言绝句",
  "七言绝句",
  "乐府",
];
const articles = JSON.parse(raw).map((poem) => ({
  id: poem.id,
  title: convert(poem.title),
  author: convert(poem.author),
  genre: genres.find((g) => poem.tags.includes(g)) || "其他诗作",
  content: poem.paragraphs.map(convert),
}));
assert.equal(
  new Set(articles.map((p) => p.id)).size,
  articles.length,
  "Duplicate poem ids",
);
assert(
  articles.every(
    (p) =>
      p.id &&
      p.title &&
      p.author &&
      p.content.length &&
      p.content.every((line) => typeof line === "string" && line.trim()),
  ),
);
await writeFile(
  "data/tang-poems.json",
  JSON.stringify(
    {
      name: "唐诗选读",
      description:
        "据 chinese-poetry 唐诗三百首标签集整理；非三百首定本，简体阅读版。",
      source,
      articles,
    },
    null,
    2,
  ) + "\n",
);
await copyFile(root + "LICENSE", "data/tang-poems.LICENSE");
console.log(
  `Imported ${articles.length} poems by ${new Set(articles.map((p) => p.author)).size} authors.`,
);
