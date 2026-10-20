import * as OpenCC from "opencc-js";
import { createHash } from "node:crypto";
const convert = OpenCC.Converter({ from: "t", to: "cn" });
const cache = new Map();
const punct = /[\s\p{P}\p{S}]/u;
export function normalize(text) {
  return [...text]
    .filter((c) => !punct.test(c))
    .map((c) => {
      if (!cache.has(c)) cache.set(c, convert(c));
      return cache.get(c);
    })
    .join("");
}
export function stream(raw) {
  let depth = 0,
    plain = "";
  const map = [];
  for (let i = 0; i < raw.length;) {
    const c = String.fromCodePoint(raw.codePointAt(i)),
      start = i;
    i += c.length;
    if (c === "(") {
      depth++;
      continue;
    }
    if (c === ")") {
      if (!depth) throw Error("Unbalanced note");
      depth--;
      continue;
    }
    if (depth) continue;
    const n = normalize(c);
    plain += n;
    for (let j = 0; j < n.length; j++) map.push(start);
  }
  if (depth) throw Error("Unclosed note");
  return { plain, map };
}
export function similarity(a, b) {
  if (!a.length || !b.length) return a === b ? 1 : 0;
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++)
      next[j] = Math.min(
        next[j - 1] + 1,
        row[j] + 1,
        row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    row = next;
  }
  return 1 - row[b.length] / Math.max(a.length, b.length);
}
const nums = Array.from({ length: 36 }, (_, i) =>
  i < 9
    ? "一二三四五六七八九"[i]
    : i === 9
      ? "十"
      : i < 19
        ? "十" + "一二三四五六七八九"[i - 10]
        : i === 19
          ? "二十"
          : i < 29
            ? "二十" + "一二三四五六七八九"[i - 20]
            : i === 29
              ? "三十"
              : "三十" + "一二三四五六七八九"[i - 30],
);
export function chapterSources(source) {
  const beginning = source.indexOf("陳仲舉言為士則");
  if (beginning < 0)
    throw Error("Cannot locate the beginning of 世說新語 main text");
  const heading =
    /^[\t 　]*[^\s()\n]+第([一二三四五六七八九十]+)(?:\([上下]\))?[^\n]*\n/gm;
  const headings = [...source.matchAll(heading)].filter(
    (m) => m.index >= beginning,
  );
  const parts = new Map([
    [0, source.slice(beginning, headings[0]?.index ?? source.length)],
  ]);
  headings.forEach((m, i) => {
    const n = nums.indexOf(m[1]);
    if (n < 0) return;
    const text = source.slice(
      m.index + m[0].length,
      headings[i + 1]?.index ?? source.length,
    );
    parts.set(n, (parts.get(n) || "") + "\n" + text);
  });
  return parts;
}
export function extractNotes(segment) {
  let depth = 0,
    chunk = "",
    notes = [];
  for (const c of segment) {
    if (c === "(") {
      if (depth++) chunk += c;
    } else if (c === ")") {
      if (--depth === 0) {
        const text = chunk.replace(/\s+/g, "").split("/").reverse().join("");
        if (text) notes.push(text);
        chunk = "";
      } else chunk += c;
    } else if (depth) chunk += c;
  }
  return notes;
}
export function alignBook(chapters, source, corrections = {}) {
  const parts = chapterSources(source),
    rows = [],
    notes = {},
    candidates = {};
  chapters.forEach((ch, chapterIndex) => {
    const raw = parts.get(chapterIndex) || "",
      { plain, map } = stream(raw);
    let cursor = 0;
    ch.content.forEach((text, i) => {
      const key = `${ch.title}:${i + 1}`,
        query = normalize(text),
        probe = query.slice(0, 32);
      let pos = plain.indexOf(probe, cursor),
        score = 1;
      if (pos < 0) {
        score = 0;
        for (let at = cursor; at <= plain.length - probe.length; at++) {
          let same = 0;
          for (let j = 0; j < probe.length; j++)
            if (probe[j] === plain[at + j]) same++;
          if (same / probe.length > score) {
            score = same / probe.length;
            pos = at;
          }
        }
      }
      const row = {
        key,
        chapter: ch.title,
        pos,
        score: Number(score.toFixed(3)),
        status: "failed",
        reason: "start-not-found",
        probe: query.slice(0, 24),
      };
      if (pos >= 0 && score >= 0.62) {
        const suffix = query.slice(-Math.min(16, query.length));
        const lo =
          pos + Math.max(0, Math.floor(query.length * 0.65) - suffix.length);
        const hi = pos + Math.ceil(query.length * 1.35) + 32;
        let endAt = plain.indexOf(suffix, lo),
          end = -1,
          fullScore = 0;
        while (endAt >= 0 && endAt < hi) {
          const e = endAt + suffix.length,
            s = similarity(query, plain.slice(pos, e));
          if (s > fullScore) {
            fullScore = s;
            end = e;
          }
          endAt = plain.indexOf(suffix, endAt + 1);
        }
        row.fullScore = Number(fullScore.toFixed(3));
        row.status = "review";
        row.reason = end < 0 ? "end-not-found" : "text-differs";
        if (end >= 0) {
          row.end = end;
          row.rawStart = map[pos];
          row.rawEnd = map[end] ?? raw.length;
          // Stop at the entry's own end, never borrow the next successful entry's boundary.
          const chunks = extractNotes(raw.slice(row.rawStart, row.rawEnd));
          if (chunks.length) candidates[key] = chunks;
          if (score >= 0.9 && fullScore >= 0.95) {
            row.status = "accepted";
            row.reason = "high-confidence";
          }
          cursor = end;
        }
      }
      const correction = corrections[key];
      if (correction) {
        if (
          !correction.reason ||
          !correction.reviewer ||
          !Array.isArray(correction.notes)
        )
          throw Error(`Invalid correction: ${key}`);
        row.status = "accepted";
        row.reason = "manual-review";
        row.review = correction;
        if (correction.notes.length) notes[key] = correction.notes;
      } else if (row.status === "accepted" && candidates[key])
        notes[key] = candidates[key];
      if (row.status === "accepted") row.hasNotes = Boolean(notes[key]);
      rows.push(row);
    });
  });
  for (const key of Object.keys(corrections))
    if (!rows.some((r) => r.key === key))
      throw Error(`Unknown correction: ${key}`);
  const stats = (items) => ({
    total: items.length,
    matched: items.filter((r) => r.status !== "failed").length,
    accepted: items.filter((r) => r.status === "accepted").length,
    annotated: items.filter((r) => notes[r.key]).length,
    withoutNotes: items.filter((r) => r.status === "accepted" && !notes[r.key])
      .length,
    needsReview: items.filter((r) => r.status === "review").length,
    failed: items.filter((r) => r.status === "failed").length,
  });
  const summary = stats(rows),
    chapterStats = Object.fromEntries(
      chapters.map((ch) => [
        ch.title,
        stats(rows.filter((r) => r.chapter === ch.title)),
      ]),
    );
  const sourceSha256 = createHash("sha256").update(source).digest("hex");
  const bookSha256 = createHash("sha256")
    .update(JSON.stringify(chapters))
    .digest("hex");
  return {
    notes,
    rows,
    candidates,
    summary,
    chapters: chapterStats,
    sourceSha256,
    bookSha256,
  };
}
