import { readFile, copyFile, cp, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const pkg = JSON.parse(
  await readFile("node_modules/leaflet/package.json", "utf8"),
);
assert.equal(pkg.version, "1.9.4");
await mkdir("assets/vendor/leaflet", { recursive: true });
const paths = ["leaflet.js", "leaflet.css", "leaflet-src.esm.js"];
for (const file of paths)
  await copyFile(
    "node_modules/leaflet/dist/" + file,
    "assets/vendor/leaflet/" + file,
  );
await copyFile("node_modules/leaflet/LICENSE", "assets/vendor/leaflet/LICENSE");
await cp("node_modules/leaflet/dist/images", "assets/vendor/leaflet/images", {
  recursive: true,
});
const manifest = {
  package: "leaflet",
  version: pkg.version,
  license: "BSD-2-Clause",
  source: "https://github.com/Leaflet/Leaflet/tree/v1.9.4",
  files: {},
};
for (const file of [...paths, "LICENSE"])
  manifest.files["assets/vendor/leaflet/" + file] = createHash("sha256")
    .update(await readFile("assets/vendor/leaflet/" + file))
    .digest("hex");
await writeFile(
  "sources/maps/leaflet-provenance.json",
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log("Vendored Leaflet 1.9.4 with license and source hashes.");
