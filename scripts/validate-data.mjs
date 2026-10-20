import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
export function validateData(chapters, output, report) {
  assert.equal(
    output._meta.bookSha256,
    createHash("sha256").update(JSON.stringify(chapters)).digest("hex"),
    "Book changed: regenerate notes",
  );
  assert.equal(report.bookSha256, output._meta.bookSha256);
  assert.equal(chapters.length, 36, "Expected 36 chapters");
  const keys = new Set(
    chapters.flatMap((ch) => ch.content.map((_, i) => `${ch.title}:${i + 1}`)),
  );
  assert.equal(report.rows.length, keys.size);
  assert.equal(new Set(report.rows.map((r) => r.key)).size, keys.size);
  for (const row of report.rows) {
    assert(keys.has(row.key));
    assert(["accepted", "review", "failed"].includes(row.status));
  }
  for (const [key, notes] of Object.entries(output.notes)) {
    assert(keys.has(key));
    assert(
      Array.isArray(notes) &&
        notes.length &&
        notes.every((n) => typeof n === "string" && n.trim()),
    );
    assert.equal(
      report.rows.find((r) => r.key === key)?.status,
      "accepted",
      "Unsafe note exposed",
    );
  }
  const check = (rows, s) => {
    assert.equal(s.total, rows.length);
    assert.equal(
      s.accepted,
      rows.filter((r) => r.status === "accepted").length,
    );
    assert.equal(s.failed, rows.filter((r) => r.status === "failed").length);
    assert.equal(
      s.needsReview,
      rows.filter((r) => r.status === "review").length,
    );
    assert.equal(s.total, s.accepted + s.needsReview + s.failed);
    assert.equal(s.matched, s.accepted + s.needsReview);
    assert.equal(s.annotated, rows.filter((r) => output.notes[r.key]).length);
    assert.equal(s.withoutNotes, s.accepted - s.annotated);
  };
  check(report.rows, report.summary);
  for (const ch of chapters)
    check(
      report.rows.filter((r) => r.chapter === ch.title),
      report.chapters[ch.title],
    );
  assert.deepEqual(output._meta.stats, report.summary);
  assert.deepEqual(output._meta.chapters, report.chapters);
  assert.equal(output._meta.sourceSha256, report.sourceSha256);
  assert.deepEqual(
    report.failed,
    report.rows.filter((r) => r.status === "failed"),
  );
  assert.deepEqual(
    report.needsReview,
    report.rows.filter((r) => r.status === "review"),
  );
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const read = async (p) => JSON.parse(await readFile(p, "utf8"));
  const provenance = await read("sources/kanripo-source.json");
  const digest = createHash("sha256")
    .update(await readFile("sources/kanripo.txt"))
    .digest("hex");
  assert.equal(digest, provenance.sha256, "Pinned source changed");
  assert.equal(
    digest,
    (await read("data/liuxiaobiao-notes.json"))._meta.sourceSha256,
    "Generated notes use a different source",
  );
  validateData(
    (await read("data/shishuo-xinyu.json")).articles,
    await read("data/liuxiaobiao-notes.json"),
    await read("data/liuxiaobiao-alignment-report.json"),
  );
  console.log(
    "Data validation passed: 36 chapters, all entry keys and statistics consistent.",
  );
}
