import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { adaptBook } from "../assets/library.mjs";
const read = async (path) => JSON.parse(await readFile(path, "utf8"));
const entityData = await read("sources/knowledge/entities.json");
const ledger = await read("sources/knowledge/reviews.json");
const catalog = await read("data/catalog.json");
const mentions = [];
const used = new Set();
const bookHashes = {};
for (const meta of catalog.books) {
  const data = await read("data/" + meta.path);
  bookHashes[meta.id] = createHash("sha256")
    .update(JSON.stringify(data.articles))
    .digest("hex");
  for (const work of adaptBook(meta, data))
    for (const [index, text] of work.content.entries())
      for (const entity of entityData.entities) {
        // Discover candidates in raw text, never in generated markup.
        for (const surface of entity.aliases) {
          let from = 0,
            start;
          while ((start = text.indexOf(surface, from)) >= 0) {
            from = start + surface.length;
            const key = `${meta.id}/${work.id}/${index + 1}/${start}/${entity.id}`;
            const id =
              "m-" +
              createHash("sha256").update(key).digest("hex").slice(0, 14);
            const digest = createHash("sha256").update(text).digest("hex");
            const record = ledger.reviews[id];
            const valid =
              record &&
              record.textSha256 === digest &&
              record.surface === surface &&
              record.start === start;
            if (valid) used.add(id);
            mentions.push({
              id,
              bookId: meta.id,
              bookTitle: meta.title,
              workId: work.id,
              title: work.title,
              entry: index + 1,
              start,
              end: start + surface.length,
              surface,
              entityId: entity.id,
              text,
              textSha256: digest,
              status: valid ? record.status : "candidate",
              period: valid ? record.period : "待考",
              context: valid
                ? record.context
                : "正文或范围变化，等待重新复核。",
              reviewer: valid ? record.reviewer : null,
              locationId: valid ? record.locationId : null,
            });
          }
        }
      }
}
const summary = Object.fromEntries(
  ["reviewed", "excluded", "pending", "candidate"].map((status) => [
    status,
    mentions.filter((m) => m.status === status).length,
  ]),
);
const output = { version: 1, bookHashes, summary, mentions };
await writeFile(
  "data/knowledge-entities.json",
  JSON.stringify(entityData, null, 2) + "\n",
);
await writeFile(
  "data/knowledge-mentions.json",
  JSON.stringify(output, null, 2) + "\n",
);
await writeFile(
  "sources/knowledge/review-report.json",
  JSON.stringify(
    {
      summary,
      staleReviewIds: Object.keys(ledger.reviews).filter((id) => !used.has(id)),
      note: "候选或待考词例不在正文加链接；排除记录不进入地图。",
    },
    null,
    2,
  ) + "\n",
);
console.log(
  "Knowledge:",
  entityData.entities.length,
  "entities,",
  mentions.length,
  "candidates.",
  summary,
);
