import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { validateCatalog, adaptBook } from "../assets/library.mjs";
const read = async (path) => JSON.parse(await readFile(path, "utf8"));
const catalog = validateCatalog(await read("data/catalog.json"));
for (const meta of catalog) {
  const data = await read("data/" + meta.path),
    articles = adaptBook(meta, data);
  assert.equal(
    meta.count,
    meta.kind === "poetry"
      ? articles.length
      : articles.reduce((s, ch) => s + ch.content.length, 0),
    meta.id + " count differs",
  );
  for (const resource of meta.resources || [])
    assert((await read("data/" + resource.path)) && resource.label);
  if (meta.kind === "poetry") {
    const raw = await readFile("sources/tang-poems/tang300.original.json");
    assert.equal(
      data.source.sha256,
      createHash("sha256").update(raw).digest("hex"),
    );
    assert.deepEqual(
      data.source,
      await read("sources/tang-poems/provenance.json"),
    );
    assert.equal(articles.length, JSON.parse(raw).length);
    assert.equal(
      await readFile("data/" + meta.licensePath, "utf8"),
      await readFile("sources/tang-poems/LICENSE", "utf8"),
    );
  }
  console.log(
    `${meta.title}: ${articles.length} sections; metadata, ids and content valid.`,
  );
}
