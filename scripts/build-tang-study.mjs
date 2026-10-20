import assert from "node:assert/strict";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { validateStudy } from "../assets/poetry-study.mjs";
export const digest = (value) =>
  createHash("sha256").update(value).digest("hex");
const root = "sources/tang-poems/study/";
const read = async (path) => JSON.parse(await readFile(path, "utf8"));
export async function compileStudy() {
  const book = await read("data/tang-poems.json");
  const manifest = await read(root + "works.json");
  const reviews = await read(root + "reviews.json");
  const references = await read(root + "references.json");
  const rows = new Map();
  for (const file of (await readdir(root))
    .filter((f) => f.endsWith(".tsv"))
    .sort()) {
    for (const raw of (await readFile(root + file, "utf8")).split(/\r?\n/)) {
      if (!raw.trim() || raw.startsWith("#")) continue;
      const [key, translation, annotations = "", remarks = ""] =
        raw.split("\t");
      const index = Number(key);
      assert(
        Number.isInteger(index) && book.articles[index] && !rows.has(index),
        "重复或无效篇目索引",
      );
      rows.set(index, {
        translations: translation.split("|"),
        notes: annotations
          ? annotations.split(";").map((s) => {
              const at = s.indexOf("=");
              assert(at > 0);
              return { word: s.slice(0, at), note: s.slice(at + 1) };
            })
          : [],
        remarks,
      });
    }
  }
  for (const [index, spec] of Object.entries(await read(root + "reuse.json"))) {
    assert(!rows.has(Number(index)), "重复异文记录");
    const source = rows.get(spec.from);
    assert(source, "缺少异文原稿");
    const row = structuredClone(source);
    for (const [line, text] of Object.entries(spec.translations || {}))
      row.translations[Number(line)] = text;
    row.notes = row.notes.map((n) => ({
      ...n,
      word: spec.notes?.[n.word] || n.word,
    }));
    row.remarks = spec.remarks ?? row.remarks;
    rows.set(Number(index), row);
  }
  const poems = {};
  for (const [index, work] of book.articles.entries()) {
    assert.equal(
      manifest[index]?.id,
      work.id,
      "底本次序变化，请按稳定 ID 重新校对原稿映射",
    );
    assert.equal(
      manifest[index]?.sourceHash,
      digest(JSON.stringify(work)),
      "正文或题署变化，需重新校对",
    );
    let row = rows.get(index);
    if (!row) {
      const equal = [...rows].find(
        ([j]) =>
          JSON.stringify(book.articles[j].content) ===
          JSON.stringify(work.content),
      );
      assert(equal, "缺少原创注译：" + work.title);
      row = {
        ...equal[1],
        remarks:
          "与本集其他篇目正文相同，保留本条题署；如有归属差异，请结合底本对读。",
      };
    }
    const review = reviews[work.id];
    assert.equal(
      review?.draftHash,
      digest(JSON.stringify(row)),
      "原稿改变，须重新校读：" + work.title,
    );
    assert.equal(
      review?.sourceHash,
      manifest[index].sourceHash,
      "复核底本已变化",
    );
    assert.equal(review?.status, "reviewed", "未通过自校的篇目不可发布");
    assert.equal(
      row.translations.length,
      work.content.length,
      "译文行数错误：" + work.title,
    );
    const titleNotes = row.notes.filter(
      (n) =>
        !work.content.some((t) => t.includes(n.word)) &&
        work.title.includes(n.word),
    );
    const notes = row.notes.filter((n) => !titleNotes.includes(n));
    const used = new Set();
    const lines = work.content.map((source, i) => ({
      source,
      sourceHash: digest(source),
      translation: row.translations[i],
      notes: notes.flatMap((n, j) => {
        const start = source.indexOf(n.word);
        if (start < 0) return [];
        used.add(j);
        return [{ ...n, start, end: start + n.word.length }];
      }),
      status: "reviewed",
    }));
    assert.equal(used.size, notes.length, "词注不在原诗中：" + work.title);
    for (const l of lines)
      l.noNoteReason = l.notes.length
        ? ""
        : "本行按上下文直译，无需另列重点词。";
    const sourceList = [
      {
        title: "正文底本：chinese-poetry 固定版本（保留原署名与异文）",
        url: book.source.url,
      },
      {
        title: "词义检索参考：《教育部重编国语辞典修订本》",
        url: "https://dict.revised.moe.edu.tw/",
      },
      ...references.common,
      ...(references.works[String(index)] || []),
    ];
    poems[work.id] = {
      title: work.title,
      author: work.author,
      status: "reviewed",
      review: {
        method: review.method,
        independentExpertReview: false,
        checks: review.checks,
      },
      editorialNote:
        "本站模型辅助原创整理，并逐行自校；未经过独立专家审校。译文依据当前底本，参考资料供核对正文和词义，不采用其中的现代译文。",
      remarks:
        row.remarks +
        (titleNotes.length
          ? " 题解：" + titleNotes.map((n) => n.word + "：" + n.note).join("；")
          : ""),
      sources: sourceList,
      lines,
    };
  }
  return validateStudy(
    { schemaVersion: 1, bookId: "tang-poems", poems },
    book.articles,
  );
}
if (process.argv[1]?.endsWith("build-tang-study.mjs")) {
  const resource = await compileStudy();
  await writeFile(
    "data/tang-poems-study.json",
    JSON.stringify(resource, null, 2) + "\n",
  );
  console.log(
    `Built ${Object.keys(resource.poems).length} poems with reviewed original study text.`,
  );
}
