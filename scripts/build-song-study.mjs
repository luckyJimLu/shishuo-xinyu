import assert from "node:assert/strict";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { validateStudy } from "../assets/poetry-study.mjs";
export const digest = (s) => createHash("sha256").update(s).digest("hex");
const root = "sources/song-ci/study/";
const read = async (p) => JSON.parse(await readFile(p, "utf8"));
export async function songDrafts() {
  const rows = new Map();
  for (const file of (await readdir(root))
    .filter((f) => f.endsWith(".tsv"))
    .sort()) {
    for (const line of (await readFile(root + file, "utf8")).split(/\r?\n/u)) {
      if (!line.trim() || line.startsWith("#")) continue;
      const [key, translations, notes = "", remarks = ""] = line.split("\t");
      const index = Number(key);
      assert(Number.isInteger(index) && !rows.has(index), "重复或无效词稿");
      rows.set(index, {
        translations: translations.split("|"),
        notes: notes
          ? notes.split(";").map((s) => {
              const at = s.indexOf("=");
              assert(at > 0);
              return { word: s.slice(0, at), note: s.slice(at + 1) };
            })
          : [],
        remarks,
      });
    }
  }
  return rows;
}
export async function compileSongStudy() {
  const book = await read("data/song-ci.json");
  const reviews = await read(root + "reviews.json");
  const rows = await songDrafts();
  assert.equal(rows.size, book.articles.length, "宋词译稿尚未全部完成");
  const poems = {};
  for (const [index, work] of book.articles.entries()) {
    const draft = rows.get(index),
      review = reviews[work.id];
    assert(draft, "缺少译稿：" + work.title);
    assert.equal(
      draft.translations.length,
      work.content.length,
      "译文行数不符：" + index + " " + work.title,
    );
    assert.equal(
      review?.sourceHash,
      digest(JSON.stringify(work)),
      "原文已变更：" + work.title,
    );
    assert.equal(
      review?.draftHash,
      digest(JSON.stringify(draft)),
      "译稿需重新自校：" + work.title,
    );
    assert.equal(review?.status, "reviewed");
    assert.equal(review.independentExpertReview, false);
    assert.equal(review.lines.length, work.content.length);
    for (const [i, source] of work.content.entries()) {
      assert.equal(review.lines[i].sourceHash, digest(source));
      assert.equal(
        review.lines[i].translationHash,
        digest(draft.translations[i]),
      );
      assert.equal(review.lines[i].status, "reviewed");
    }
    const used = new Set();
    const lines = work.content.map((source, line) => ({
      source,
      sourceHash: digest(source),
      translation: draft.translations[line],
      status: "reviewed",
      notes: draft.notes.flatMap((n, j) => {
        const start = source.indexOf(n.word);
        if (start < 0 || used.has(j)) return [];
        used.add(j);
        return [{ ...n, start, end: start + n.word.length }];
      }),
    }));
    assert.equal(
      used.size,
      draft.notes.length,
      "词注无法定位：" +
        index +
        " " +
        draft.notes.filter((_, j) => !used.has(j)).map((n) => n.word),
    );
    for (const l of lines) {
      assert(
        l.translation?.trim() &&
          l.translation !== l.source &&
          !/TODO|待补|暂无译文/u.test(l.translation),
      );
      l.noNoteReason = l.notes.length
        ? ""
        : "本行结合上下文直译，未另列重点词。";
    }
    poems[work.id] = {
      title: work.title,
      author: work.author,
      status: "reviewed",
      editorialNote:
        "本站模型辅助原创整理并逐行自校，未经独立专家审校。译文依当前底本，不复制参考资料中的现代译文；疑难句义与题署问题保留说明。资料链接供读者核对原文、词义与典故，不代表每项解释已经外部专家验证。",
      remarks: draft.remarks,
      review: {
        method: review.method,
        independentExpertReview: false,
        checks: review.checks,
      },
      sources: [
        { title: "正文底本：chinese-poetry 固定版本", url: book.source.url },
        {
          title: "原典对读入口：《宋词三百首》（维基文库）",
          url: "https://zh.wikisource.org/wiki/宋詞三百首",
        },
        {
          title: "词义核对入口：《教育部重编国语辞典修订本》",
          url: "https://dict.revised.moe.edu.tw/",
        },
      ],
      lines,
    };
  }
  return validateStudy(
    { schemaVersion: 1, bookId: "song-ci", poems },
    book.articles,
    "song-ci",
  );
}
if (process.argv[1]?.endsWith("build-song-study.mjs")) {
  const data = await compileSongStudy();
  await writeFile(
    "data/song-ci-study.json",
    JSON.stringify(data, null, 2) + "\n",
  );
  console.log(`Built ${Object.keys(data.poems).length} Song ci studies.`);
}
