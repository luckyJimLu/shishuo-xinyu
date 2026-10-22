import assert from "node:assert/strict";
import { readFile, writeFile, copyFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import * as OpenCC from "opencc-js";
import { validateProse } from "../assets/prose-translations.mjs";
export const digest = (s) => createHash("sha256").update(s).digest("hex");
const root = "sources/daxue/";
const read = async (p) => JSON.parse(await readFile(p, "utf8"));
export async function daxueDrafts() {
  return (await readFile(root + "study.tsv", "utf8"))
    .trimEnd()
    .split(/\r?\n/u)
    .map((line, i) => {
      const [index, title, translation, notes, remarks = ""] = line.split("\t");
      assert.equal(Number(index), i, "段稿次序变更");
      assert(title && translation && notes, "段稿缺漏");
      return {
        title,
        translation,
        notes: notes.split(";").map((n) => {
          const at = n.indexOf("=");
          assert(at > 0);
          return { word: n.slice(0, at), note: n.slice(at + 1) };
        }),
        remarks,
      };
    });
}
export async function daxueBook() {
  const raw = await readFile(root + "daxue.original.json"),
    source = await read(root + "provenance.json");
  assert.equal(digest(raw), source.sha256, "大学底本变化");
  const original = JSON.parse(raw),
    convert = OpenCC.Converter({ from: "t", to: "cn" }),
    rows = await daxueDrafts();
  assert.equal(original.chapter, "大學");
  assert.equal(original.paragraphs.length, 16);
  assert.equal(rows.length, 16);
  return {
    name: "大学",
    description:
      "《礼记·大学》古本次序，保留16段；段题由本站整理，不是朱熹章句本的经传分章。",
    source,
    articles: original.paragraphs.map((p, i) => ({
      id: `chapter-${String(i + 1).padStart(2, "0")}`,
      title: rows[i].title,
      content: [convert(p)],
    })),
  };
}
export async function compileDaxue() {
  const book = await daxueBook(),
    rows = await daxueDrafts(),
    reviews = await read(root + "reviews.json"),
    entries = {};
  const editorialNote =
    "本站依据固定底本，由模型辅助原创整理注释与译文，并逐段自校；未经过独立专家审校。保留《礼记·大学》原有16段顺序，段题为本站自拟；不混入朱熹《大学章句》的重排次序或格物补传。参考链接供核对，不复制其中现代译文。";
  for (const [i, w] of book.articles.entries()) {
    const row = rows[i],
      source = w.content[0],
      review = reviews[w.id];
    assert.equal(
      review?.sourceHash,
      digest(JSON.stringify(w)),
      "底本段落变更，需自校",
    );
    assert.equal(
      review?.draftHash,
      digest(JSON.stringify(row)),
      "注译稿变更，需自校",
    );
    assert.equal(review?.status, "reviewed");
    assert.equal(review.independentExpertReview, false);
    const notes = row.notes.map((n) => {
      const start = source.indexOf(n.word);
      assert(start >= 0, `无法定位词注 ${i} ${n.word}`);
      return { ...n, start, end: start + n.word.length };
    });
    entries[`${w.id}:1`] = {
      chapterId: w.id,
      entry: 1,
      source,
      sourceHash: digest(source),
      translation: row.translation,
      notes,
      status: "reviewed",
      segments: [{ source, translation: row.translation, status: "reviewed" }],
      remarks: row.remarks,
      review: {
        method: review.method,
        checks: review.checks,
        independentExpertReview: false,
      },
      sources: [
        {
          title: "正文底本：chinese-poetry 固定版本《大学》",
          url: book.source.url,
        },
        {
          title: "原典对读入口：《礼记·大学》（中国哲学书电子化计划）",
          url: "https://ctext.org/liji/da-xue/zhs",
        },
        {
          title: "词义核对入口：教育部《重编国语辞典修订本》",
          url: "https://dict.revised.moe.edu.tw/",
        },
      ],
    };
  }
  const study = validateProse(
    { schemaVersion: 1, bookId: "daxue", editorialNote, entries },
    book.articles,
    "daxue",
  );
  return { book, study };
}
if (process.argv[1]?.endsWith("build-daxue.mjs")) {
  const { book, study } = await compileDaxue();
  await writeFile("data/daxue.json", JSON.stringify(book, null, 2) + "\n");
  await writeFile(
    "data/daxue-study.json",
    JSON.stringify(study, null, 2) + "\n",
  );
  await copyFile(root + "LICENSE", "data/daxue.LICENSE");
  console.log(
    `Built 大学: ${book.articles.length} sections, ${Object.values(study.entries).reduce((n, e) => n + e.notes.length, 0)} notes.`,
  );
}
