import assert from "node:assert/strict";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { digest } from "./build-tang-study.mjs";
import { validateContext } from "../assets/poetry-context.mjs";
const root = "sources/tang-poems/context/";
const read = async (p) => JSON.parse(await readFile(p, "utf8"));
export const sourceValue = (w) =>
  JSON.stringify({
    id: w.id,
    title: w.title,
    author: w.author,
    content: w.content,
  });
export async function compileContext() {
  const book = await read("data/tang-poems.json"),
    manifest = await read(root + "works.json"),
    reviews = await read(root + "reviews.json"),
    reuse = await read(root + "reuse.json");
  const references = await read(root + "references.json");
  const rows = new Map();
  for (const file of (await readdir(root))
    .filter((f) => f.endsWith(".tsv"))
    .sort())
    for (const raw of (await readFile(root + file, "utf8"))
      .trimEnd()
      .split(/\r?\n/)) {
      const [key, background, mood, evidence, ...extra] = raw.split("\t"),
        i = Number(key);
      assert(
        Number.isInteger(i) &&
          book.articles[i] &&
          !rows.has(i) &&
          !extra.length,
        "背景原稿定位无效",
      );
      assert(
        background?.trim() && mood?.trim() && evidence?.trim(),
        "背景原稿不完整",
      );
      rows.set(i, { background, mood, evidence, remarks: "" });
    }
  for (const [key, value] of Object.entries(reuse)) {
    const i = Number(key),
      spec = typeof value === "number" ? { from: value } : value;
    assert(!rows.has(i) && rows.has(spec.from), "重复或无效复用");
    const a = book.articles[spec.from],
      b = book.articles[i],
      row = { ...rows.get(spec.from) };
    row.evidence = spec.evidence || row.evidence;
    row.remarks = `本集另收相近文本《${a.title}》（${a.author}），本条保留《${b.title}》（${b.author}）题署；背景按当前正文核对，不以相近文本推定作者生平。`;
    rows.set(i, row);
  }
  const works = {};
  for (const [i, w] of book.articles.entries()) {
    const row = rows.get(i),
      m = manifest[i],
      r = reviews[w.id];
    assert(row, "缺少背景：" + w.title);
    assert.equal(m?.id, w.id, "篇目次序改变，须重核原稿索引");
    assert.equal(m.sourceHash, digest(sourceValue(w)), "背景底本改变");
    assert.equal(r?.sourceHash, m.sourceHash);
    assert.equal(
      r?.draftHash,
      digest(JSON.stringify(row)),
      "背景原稿改变，须重新自校：" + w.title,
    );
    assert.equal(r.status, "reviewed");
    assert(
      w.content.join("").includes(row.evidence),
      "心境依据不在当前诗文：" + w.title,
    );
    works[w.id] = {
      id: w.id,
      title: w.title,
      author: w.author,
      source: w.content,
      sourceHash: m.sourceHash,
      ...row,
      status: r.status,
      review: r,
      sources: [
        {
          title:
            "背景与情绪的首要依据：本站当前题目、署名和正文（固定版本底本）",
          url: book.source.url,
        },
        {
          title: "《全唐詩》原典目录与相关作品对读入口",
          url: "https://zh.wikisource.org/wiki/全唐詩",
        },
        ...(references[String(i)] || []),
      ],
    };
  }
  assert.equal(rows.size, book.articles.length);
  return validateContext(
    {
      schemaVersion: 1,
      bookId: "tang-poems",
      editorialNote:
        "模型辅助原创整理与自校，未经独立专家审校。背景以题目、正文可确认的情境为主；具体年月、对象或寄托未定时保留疑义。诗中情绪是依据原句的解读，不等于作者真实心理的传记定论。",
      works,
    },
    book.articles,
  );
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const data = await compileContext();
  await writeFile(
    "data/tang-poems-context.json",
    JSON.stringify(data, null, 2) + "\n",
  );
  console.log(
    "Generated " + Object.keys(data.works).length + " poetry contexts.",
  );
}
