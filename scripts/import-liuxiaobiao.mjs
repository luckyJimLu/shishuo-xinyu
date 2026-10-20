import { readFile, writeFile, rename } from "node:fs/promises";
import { alignBook } from "./liu-core.mjs";
import { validateData } from "./validate-data.mjs";
const sourcePath = process.argv[2] || "sources/kanripo.txt";
const source = await readFile(sourcePath, "utf8");
const data = JSON.parse(await readFile("data/shishuo-xinyu.json", "utf8"));
const corrections = JSON.parse(
  await readFile("data/liuxiaobiao-corrections.json", "utf8"),
);
const result = alignBook(data.articles, source, corrections);
const provenance = JSON.parse(
  await readFile("sources/kanripo-source.json", "utf8"),
);
if (result.sourceSha256 !== provenance.sha256)
  throw Error(
    "Source hash differs; update provenance explicitly before importing",
  );
const output = {
  _meta: {
    title: "刘孝标注（结构化摘录）",
    license: "CC0-1.0",
    scope: "世说新语三十六门",
    source: provenance,
    sourceSha256: result.sourceSha256,
    bookSha256: result.bookSha256,
    generated_by: "scripts/import-liuxiaobiao.mjs",
    stats: result.summary,
    chapters: result.chapters,
  },
  notes: result.notes,
};
const report = {
  source: provenance,
  sourceSha256: result.sourceSha256,
  bookSha256: result.bookSha256,
  summary: result.summary,
  chapters: result.chapters,
  rows: result.rows,
  needsReview: result.rows.filter((r) => r.status === "review"),
  failed: result.rows.filter((r) => r.status === "failed"),
  candidates: result.candidates,
};
validateData(data.articles, output, report);
for (const [path, value] of [
  ["data/liuxiaobiao-notes.json", output],
  ["data/liuxiaobiao-alignment-report.json", report],
]) {
  await writeFile(path + ".tmp", JSON.stringify(value, null, 2) + "\n");
  await rename(path + ".tmp", path);
}
console.log(JSON.stringify(result.summary, null, 2));
