import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { digest } from "./build-tang-study.mjs";
import { validateProse } from "../assets/prose-translations.mjs";
export const root = "sources/shishuo-translations/";
export const read = async (p) => JSON.parse(await readFile(p, "utf8"));
export const proseWorks = (raw) =>
  raw.articles.map((w, i) => ({
    ...w,
    id: `chapter-${String(i + 1).padStart(2, "0")}`,
  }));
export async function compileProse() {
  const works = proseWorks(await read("data/shishuo-xinyu.json"));
  const drafts = await read(root + "segments.json"),
    reviews = await read(root + "reviews.json"),
    references = await read(root + "references.json");
  const entries = {},
    compatibility = {};
  for (const [ci, w] of works.entries()) {
    const rows = (
      await readFile(root + String(ci + 1).padStart(2, "0") + ".tsv", "utf8")
    )
      .trimEnd()
      .split(/\r?\n/);
    assert.equal(rows.length, w.content.length, "译稿则数改变");
    for (const [i, source] of w.content.entries()) {
      const key = `${w.id}:${i + 1}`,
        [number, translation, ...extra] = rows[i].split("\t");
      assert.equal(number, String(i + 1));
      assert.equal(extra.length, 0);
      assert(translation?.trim());
      const draft = drafts[key],
        review = reviews[key];
      assert(draft, "缺少分句稿：" + key);
      assert.equal(
        draft.segments.map((s) => s.source).join(""),
        source,
        "分句原文不连续：" + key,
      );
      assert.equal(
        draft.segments.map((s) => s.translation).join(""),
        translation,
        "分句译文不一致：" + key,
      );
      assert.equal(
        review?.sourceHash,
        digest(source),
        "正文改变，须重新复核：" + key,
      );
      assert.equal(
        review?.draftHash,
        digest(JSON.stringify(draft)),
        "译稿改变，须重新复核：" + key,
      );
      assert.equal(review.status, "reviewed");
      const entry = {
        chapterId: w.id,
        entry: i + 1,
        source,
        sourceHash: digest(source),
        ...draft,
        translation,
        status: review.status,
        sources: references,
        review,
      };
      entries[key] = entry;
      compatibility[w.title + ":" + (i + 1)] = translation;
    }
  }
  assert.equal(
    Object.keys(drafts).length,
    Object.keys(entries).length,
    "多余分句稿",
  );
  const resource = {
    schemaVersion: 1,
    bookId: "shishuo-xinyu",
    editorialNote:
      "依据本站正文，模型辅助原创整理与自校；未经过独立专家审校。疑难字句采用的读法见条目整理记录。刘孝标注不在翻译范围。",
    entries,
  };
  validateProse(resource, works);
  return { resource, compatibility };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const { resource, compatibility } = await compileProse();
  await writeFile(
    "data/shishuo-translations.json",
    JSON.stringify(resource, null, 2) + "\n",
  );
  await writeFile(
    "data/translations.json",
    JSON.stringify(compatibility, null, 2) + "\n",
  );
  console.log(
    `Generated ${Object.keys(resource.entries).length} prose translations.`,
  );
}
