import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { adaptBook } from "../assets/library.mjs";
import { validateKnowledge } from "../assets/knowledge.mjs";
const read = async (path) => JSON.parse(await readFile(path, "utf8"));
const entities = await read("data/knowledge-entities.json"),
  data = await read("data/knowledge-mentions.json");
validateKnowledge(entities, data);
assert.equal(entities.entities.length, 40);
assert.equal(entities.entities.filter((e) => e.type === "place").length, 20);
const catalog = await read("data/catalog.json");
assert(
  data.mentions.every((m) => catalog.books.some((b) => b.id === m.bookId)),
  "未知书目词例",
);
for (const meta of catalog.books) {
  const raw = await read("data/" + meta.path);
  assert.equal(
    data.bookHashes[meta.id],
    createHash("sha256").update(JSON.stringify(raw.articles)).digest("hex"),
    "正文变化：请重新生成名物候选并复核",
  );
  const book = adaptBook(meta, raw);
  for (const m of data.mentions.filter((m) => m.bookId === meta.id)) {
    const text = book.find((ch) => ch.id === m.workId)?.content[m.entry - 1];
    assert(text);
    assert.equal(m.text, text);
    assert.equal(text.slice(m.start, m.end), m.surface);
    assert.equal(m.textSha256, createHash("sha256").update(text).digest("hex"));
  }
}
for (const status of ["reviewed", "excluded", "pending", "candidate"])
  assert.equal(
    data.summary[status],
    data.mentions.filter((m) => m.status === status).length,
  );
const provenance = await read("sources/maps/provenance.json");
for (const [path, digest] of Object.entries(provenance.artifacts))
  assert.equal(
    createHash("sha256")
      .update(await readFile(path))
      .digest("hex"),
    digest,
    "地图来源摘要变化",
  );
const references = (await read("sources/maps/reference-places.json")).features;
for (const e of entities.entities)
  for (const l of e.locations || []) {
    const reference = references.find((r) => r.name === l.referenceCity);
    assert(reference);
    assert.deepEqual(l.coordinates, reference.coordinates);
  }
assert.deepEqual(entities, await read("sources/knowledge/entities.json"));
console.log(
  "Knowledge verified: 40 entities;",
  data.summary.reviewed,
  "published mentions;",
  data.summary.pending,
  "pending;",
  data.summary.excluded,
  "excluded.",
);

const vendor = await read("sources/maps/leaflet-provenance.json");
for (const [path, digest] of Object.entries(vendor.files))
  assert.equal(
    createHash("sha256")
      .update(await readFile(path))
      .digest("hex"),
    digest,
    "地图运行库摘要变化",
  );
