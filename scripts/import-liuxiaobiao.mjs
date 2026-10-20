import { readFile, writeFile } from "node:fs/promises";

const SOURCE_URL =
  "https://raw.githubusercontent.com/kr-shadow/KR3/master/" +
  encodeURIComponent("KR3l0002 世說新語-劉宋-劉義慶.txt");

const source = await fetch(SOURCE_URL).then(async r => {
  if (!r.ok) throw new Error(`Failed to fetch Kanripo source: ${r.status}`);
  return r.text();
});

const data = JSON.parse(await readFile("data/shishuo-xinyu.json", "utf8"));
const chapters = data.articles || data.content || data.data || data;
const chapter = chapters.find(x => x.title === "德行");
if (!chapter) throw new Error("Cannot find 德行 chapter");

const start = source.indexOf("陳仲舉言為士則");
const end = source.indexOf("言語第二", start);
if (start < 0 || end < 0) throw new Error("Cannot locate 德行第一 in Kanripo source");

const raw = source.slice(start, end);
const punct = /[\s，。！？；：、“”‘’（）()《》〈〉【】\[\]—…·,.!?;:'"「」『』]/;

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

const normalize = s => [...String(s)].filter(ch => !punct.test(ch)).join("");

function bestStart(query, from) {
  const probe = query.slice(0, Math.min(32, query.length));
  let best = { pos: -1, score: -1 };
  const lo = Math.max(0, from - 20);
  const hi = Math.min(plain.length - probe.length, from + 1200);

  for (let pos = lo; pos <= hi; pos++) {
    let same = 0;
    for (let j = 0; j < probe.length; j++) {
      if (plain[pos + j] === probe[j]) same++;
    }
    const score = same / probe.length;
    if (score > best.score) {
      best = { pos, score };
      if (score === 1) break;
    }
  }
  return best;
}

let cursor = 0;
const positions = [];
const diagnostics = [];

for (let i = 0; i < chapter.content.length; i++) {
  const q = normalize(chapter.content[i]);
  const match = bestStart(q, cursor);
  if (match.pos < 0 || match.score < 0.45) {
    throw new Error(`Low-confidence alignment at 德行:${i + 1}, score=${match.score}`);
  }
  positions.push(match.pos);
  diagnostics.push({ key: `德行:${i + 1}`, score: Number(match.score.toFixed(3)) });
  cursor = match.pos + Math.max(1, Math.floor(q.length * 0.75));
}

const notes = {};
for (let i = 0; i < positions.length; i++) {
  const rawStart = rawMap[positions[i]];
  const rawEnd = i + 1 < positions.length ? rawMap[positions[i + 1]] : raw.length;
  const segment = raw.slice(rawStart, rawEnd);

  const chunks = [...segment.matchAll(/\(([\s\S]*?)\)/g)]
    .map(m => m[1].replace(/\s+/g, "").trim())
    .filter(Boolean)
    .map(text => text.split("/").reverse().join(""));

  if (chunks.length) notes[`德行:${i + 1}`] = chunks;
}

const output = {
  _meta: {
    title: "刘孝标注（结构化摘录）",
    source_repo: "kr-shadow/KR3",
    source_file: "KR3l0002 世說新語-劉宋-劉義慶.txt",
    license: "CC0-1.0",
    scope: "德行第一",
    normalization: "双栏转写 / 分隔按阅读顺序重排；去除换行，保留原字形。",
    generated_by: "scripts/import-liuxiaobiao.mjs",
    diagnostics
  },
  notes
};

await writeFile("data/liuxiaobiao-notes.json", JSON.stringify(output, null, 2) + "\n");
console.log(`Generated ${Object.keys(notes).length} annotated entries.`);
