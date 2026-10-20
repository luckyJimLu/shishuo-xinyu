import { readFile, writeFile } from "node:fs/promises";

const SOURCE_URL =
  "https://raw.githubusercontent.com/kr-shadow/KR3/master/" +
  encodeURIComponent("KR3l0002 世說新語-劉宋-劉義慶.txt");
const MIN_SCORE = 0.42;
const REVIEW_SCORE = 0.62;
const WINDOW = 9000;

const source = await fetch(SOURCE_URL).then(async r => {
  if (!r.ok) throw new Error(`Failed to fetch Kanripo source: ${r.status}`);
  return r.text();
});
const data = JSON.parse(await readFile("data/shishuo-xinyu.json", "utf8"));
const chapters = data.articles || data.content || data.data || data;

const firstText = chapters[0]?.content?.[0];
if (!firstText) throw new Error("Book dataset is empty");

const punct = /[\s，。！？；：、“”‘’（）()《》〈〉【】\[\]—…·,.!?;:'"「」『』]/;
const normalize = s => [...String(s)].filter(ch => !punct.test(ch)).join("");

// Locate the main text, then build a note-free stream plus a map back to raw source.
// Parentheses in this Kanripo transcription contain Liu Xiaobiao's interlinear notes.
const firstProbe = normalize(firstText).slice(0, 8);
let rawStart = source.indexOf("陳仲舉言為士則");
if (rawStart < 0) rawStart = Math.max(0, source.indexOf(firstProbe));
if (rawStart < 0) throw new Error("Cannot locate the beginning of 世說新語 main text");
const raw = source.slice(rawStart);

let depth = 0;
let plain = "";
const rawMap = [];
for (let i = 0; i < raw.length; i++) {
  const ch = raw[i];
  if (ch === "(") { depth++; continue; }
  if (ch === ")") { if (depth) depth--; continue; }
  if (depth || punct.test(ch)) continue;
  plain += ch;
  rawMap.push(i);
}

function scoreAt(probe, pos) {
  let same = 0;
  for (let j = 0; j < probe.length; j++) if (plain[pos + j] === probe[j]) same++;
  return same / probe.length;
}

function bestStart(query, from) {
  const probe = query.slice(0, Math.min(32, query.length));
  let best = { pos: -1, score: -1 };
  const lo = Math.max(0, from - 40);
  const hi = Math.min(plain.length - probe.length, from + WINDOW);
  for (let pos = lo; pos <= hi; pos++) {
    const score = scoreAt(probe, pos);
    if (score > best.score) {
      best = { pos, score };
      if (score === 1) break;
    }
  }
  return best;
}

const entries = chapters.flatMap(chapter =>
  chapter.content.map((text, i) => ({ chapter: chapter.title, n: i + 1, text }))
);

let cursor = 0;
const aligned = [];
const review = [];
const failed = [];

for (const entry of entries) {
  const query = normalize(entry.text);
  const match = bestStart(query, cursor);
  const row = {
    key: `${entry.chapter}:${entry.n}`,
    pos: match.pos,
    score: Number(match.score.toFixed(3)),
    probe: query.slice(0, 24)
  };
  if (match.pos < 0 || match.score < MIN_SCORE) {
    failed.push(row);
    // Do not advance the cursor: the next entry may re-synchronize naturally.
    aligned.push({ ...entry, ...row, pos: -1 });
    continue;
  }
  aligned.push({ ...entry, ...row });
  if (match.score < REVIEW_SCORE) review.push(row);
  cursor = match.pos + Math.max(1, Math.floor(query.length * 0.65));
}

const notes = {};
for (let i = 0; i < aligned.length; i++) {
  const item = aligned[i];
  if (item.pos < 0) continue;
  const next = aligned.slice(i + 1).find(x => x.pos >= 0);
  const start = rawMap[item.pos];
  const end = next ? rawMap[next.pos] : raw.length;
  const segment = raw.slice(start, end);
  const chunks = [...segment.matchAll(/\(([\s\S]*?)\)/g)]
    .map(m => m[1].replace(/\s+/g, "").trim())
    .filter(Boolean)
    // The source is a two-column transcription. '/' separates reversed visual columns.
    .map(text => text.split("/").reverse().join(""));
  if (chunks.length) notes[item.key] = chunks;
}

const chapterStats = Object.fromEntries(chapters.map(ch => {
  const prefix = `${ch.title}:`;
  const total = ch.content.length;
  const matched = aligned.filter(x => x.key.startsWith(prefix) && x.pos >= 0).length;
  const annotated = Object.keys(notes).filter(k => k.startsWith(prefix)).length;
  const needsReview = review.filter(x => x.key.startsWith(prefix)).length;
  return [ch.title, { total, matched, annotated, needsReview }];
}));

const output = {
  _meta: {
    title: "刘孝标注（结构化摘录）",
    source_repo: "kr-shadow/KR3",
    source_file: "KR3l0002 世說新語-劉宋-劉義慶.txt",
    license: "CC0-1.0",
    scope: "世说新语三十六门",
    normalization: "双栏转写 / 分隔按阅读顺序重排；去除换行，保留原字形。",
    generated_by: "scripts/import-liuxiaobiao.mjs",
    thresholds: { minimum: MIN_SCORE, review: REVIEW_SCORE },
    stats: {
      total: entries.length,
      matched: aligned.filter(x => x.pos >= 0).length,
      annotated: Object.keys(notes).length,
      needsReview: review.length,
      failed: failed.length
    },
    chapters: chapterStats
  },
  notes
};

const report = {
  generatedAt: new Date().toISOString(),
  source: SOURCE_URL,
  thresholds: { minimum: MIN_SCORE, review: REVIEW_SCORE },
  summary: output._meta.stats,
  chapters: chapterStats,
  needsReview: review,
  failed
};

await writeFile("data/liuxiaobiao-notes.json", JSON.stringify(output, null, 2) + "\n");
await writeFile("data/liuxiaobiao-alignment-report.json", JSON.stringify(report, null, 2) + "\n");

console.log(`Entries: ${entries.length}`);
console.log(`Matched: ${output._meta.stats.matched}`);
console.log(`Annotated: ${output._meta.stats.annotated}`);
console.log(`Needs review: ${review.length}`);
console.log(`Failed: ${failed.length}`);
if (failed.length) {
  console.error("Some entries could not be aligned. See data/liuxiaobiao-alignment-report.json");
  process.exitCode = 2;
}
