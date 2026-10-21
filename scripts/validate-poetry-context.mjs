import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { compileContext } from "./build-poetry-context.mjs";
import {
  validateContext,
  verifyContextHashes,
} from "../assets/poetry-context.mjs";
const book = JSON.parse(await readFile("data/tang-poems.json", "utf8"));
const data = JSON.parse(await readFile("data/tang-poems-context.json", "utf8"));
validateContext(data, book.articles);
await verifyContextHashes(data);
assert.deepEqual(
  data,
  await compileContext(),
  "背景资源与原稿或复核记录不一致",
);
assert.equal(Object.keys(data.works).length, 366);
console.log(
  "Poetry context verified: 366 works, exact source quotations, source hashes and review records.",
);
