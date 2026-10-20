import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  externalLink,
  safeMentions,
  mergedSpans,
  markerGroups,
  atlasPlaces,
  mentionRoute,
  atlasRoute,
  validateKnowledge,
} from "../assets/knowledge.mjs";
import { parseRoute } from "../assets/library.mjs";
const entities = JSON.parse(
  await readFile("data/knowledge-entities.json", "utf8"),
);
const data = JSON.parse(await readFile("data/knowledge-mentions.json", "utf8"));
test("all 40 entities have safe encoded research links", () => {
  assert.equal(entities.entities.length, 40);
  for (const e of entities.entities) {
    const u = new URL(externalLink(e));
    assert.equal(u.hostname, "www.google.com");
    assert.equal(
      u.searchParams.get(e.type === "place" ? "query" : "q"),
      e.searchQuery,
    );
    assert.equal(
      u.searchParams.get(e.type === "place" ? "api" : "tbm"),
      e.type === "place" ? "1" : "isch",
    );
  }
  const yangzhou = entities.entities.find((e) => e.id === "yangzhou");
  assert.match(
    new URL(externalLink(yangzhou, "yangzhou-jin-reference")).searchParams.get(
      "query",
    ),
    /南京/,
  );
  assert.equal(
    new URL(externalLink(yangzhou, "yangzhou-reference")).searchParams.get(
      "query",
    ),
    "中国 江苏 扬州",
  );
});
test("overlapping annotation and object become one trigger while repeats remain distinct", () => {
  const text = "登车揽辔，辔在手。";
  const mentions = [
    { start: 3, end: 4, id: "one" },
    { start: 5, end: 6, id: "two" },
  ];
  const ranges = mergedSpans(text, [{ word: "揽辔", note: "执缰" }], mentions);
  assert.equal(ranges.length, 2);
  assert.equal(text.slice(ranges[0].start, ranges[0].end), "揽辔");
  assert.equal(ranges[0].notes[0].note, "执缰");
  assert.equal(ranges[0].mentions.length, 1);
  assert.equal(ranges[1].mentions[0].id, "two");
});
test("only reviewed, exact-context occurrences are published", () => {
  const m = data.mentions.find((m) => m.status === "reviewed");
  assert.equal(
    safeMentions({ mentions: [m] }, m.bookId, m.workId, m.entry, m.text).length,
    1,
  );
  for (const status of ["candidate", "pending", "excluded"])
    assert.equal(
      safeMentions(
        { mentions: [{ ...m, status }] },
        m.bookId,
        m.workId,
        m.entry,
        m.text,
      ).length,
      0,
    );
  assert.equal(
    safeMentions({ mentions: [m] }, m.bookId, m.workId, m.entry, m.text + "改")
      .length,
    0,
  );
  assert.equal(
    safeMentions(
      { mentions: [{ ...m, start: -1 }] },
      m.bookId,
      m.workId,
      m.entry,
      m.text,
    ).length,
    0,
  );
});
test("homonyms, personal titles, work names and landscape metaphors are excluded", () => {
  const cases = [
    ["荆州", "殷荆州"],
    ["会稽", "会稽王"],
    ["琴", "琴赋"],
    ["瑟", "萧瑟"],
    ["香炉", "香炉瀑布"],
    ["如意", "小如意"],
    ["履", "履行"],
    ["广陵", "广陵散"],
  ];
  for (const [surface, context] of cases) {
    const rows = data.mentions.filter(
      (m) => m.surface === surface && m.text.includes(context),
    );
    assert(rows.length);
    for (const row of rows)
      assert.notEqual(row.status, "reviewed", surface + " " + context);
  }
  const crossing = data.mentions.find((m) => m.title === "题金陵渡");
  assert.equal(crossing.status, "pending");
});
test("atlas filters by semantic period and current work, not book compilation date", () => {
  const places = atlasPlaces(entities, data, {
    book: "tang-poems",
    period: "汉",
  });
  assert(places.some((p) => p.entity.id === "changan"));
  const m = data.mentions.find(
    (m) => m.entityId === "yuzhang" && m.status === "reviewed",
  );
  const scoped = atlasPlaces(entities, data, {
    scope: "current",
    contextBook: m.bookId,
    work: m.workId,
  });
  assert(
    scoped
      .flatMap((p) => p.mentions)
      .every((r) => r.bookId === m.bookId && r.workId === m.workId),
  );
  assert.equal(atlasPlaces(entities, data, { q: "不存在的地方" }).length, 0);
});
test("shared reference points merge and unlocated places never get a marker", () => {
  const all = atlasPlaces(entities, data);
  const groups = markerGroups(all);
  assert(
    groups.some(
      (g) =>
        g.places.some((p) => p.entity.id === "jinling") &&
        g.places.some((p) => p.entity.id === "jiankang"),
    ),
  );
  assert.equal(
    markerGroups(
      atlasPlaces(entities, data, { q: "荆州" }).filter(
        (p) => p.entity.id === "jingzhou",
      ),
    ).length,
    0,
  );
});
test("mention and atlas URLs round-trip without breaking legacy routes", () => {
  const m = data.mentions.find((m) => m.status === "reviewed");
  assert.equal(parseRoute(mentionRoute(m)).mentionId, m.id);
  const route = parseRoute(
    atlasRoute({
      book: "tang-poems",
      period: "唐",
      q: "长安",
      place: "changan",
    }),
  );
  assert.equal(route.view, "atlas");
  assert.equal(route.filters.q, "长安");
  assert.equal(route.filters.period, "唐");
  assert.equal(parseRoute("#/chapter/德行").view, "legacy");
});
test("malformed metadata and coordinates are rejected", () => {
  assert(validateKnowledge(entities, data));
  const bad = structuredClone(entities);
  bad.entities[0].locations[0].coordinates = [999, 99];
  assert.throws(() => validateKnowledge(bad, data));
  const duplicate = { ...data, mentions: [data.mentions[0], data.mentions[0]] };
  assert.throws(() => validateKnowledge(entities, duplicate));
});
