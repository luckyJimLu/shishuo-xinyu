import { readFile, writeFile, copyFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import * as OpenCC from "opencc-js";
const root = "sources/song-ci/";
export async function compileSongCi() {
  const raw = await readFile(root + "song300.original.json");
  const source = JSON.parse(await readFile(root + "provenance.json", "utf8"));
  assert.equal(
    createHash("sha256").update(raw).digest("hex"),
    source.sha256,
    "Song source changed",
  );
  const convert = OpenCC.Converter({ from: "t", to: "cn" });
  const articles = JSON.parse(raw).map((work) => {
    assert(work.author && work.rhythmic && work.paragraphs?.length);
    const content = work.paragraphs.map(convert);
    const tune = convert(work.rhythmic);
    const first = content[0].split(/[，。！？、；：]/u)[0];
    // Hash the original identity: IDs survive reordering and conversion updates.
    const id =
      "ci-" +
      createHash("sha256")
        .update(JSON.stringify([work.author, work.rhythmic, work.paragraphs]))
        .digest("hex")
        .slice(0, 24);
    return {
      id,
      title: `${tune} · ${first}`,
      author: convert(work.author),
      genre: tune.split(/[・·]/u)[0],
      tune,
      content,
    };
  });
  assert.equal(
    new Set(articles.map((w) => w.id)).size,
    articles.length,
    "Duplicate ci identities",
  );
  assert(
    articles.every((w) =>
      w.content.every((line) => typeof line === "string" && line.trim()),
    ),
  );
  return {
    name: "宋词选集",
    description:
      "据 chinese-poetry 宋词三百首数据整理，实际280首；保留底本分句，不推定上下阕。",
    source,
    articles,
  };
}
if (process.argv[1]?.endsWith("import-song-ci.mjs")) {
  const data = await compileSongCi();
  await writeFile("data/song-ci.json", JSON.stringify(data, null, 2) + "\n");
  await copyFile(root + "LICENSE", "data/song-ci.LICENSE");
  console.log(
    `Imported ${data.articles.length} ci by ${new Set(data.articles.map((w) => w.author)).size} authors.`,
  );
}
