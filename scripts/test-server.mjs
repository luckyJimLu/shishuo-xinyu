import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
const root = resolve("dist");
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".geojson": "application/geo+json; charset=utf-8",
  ".png": "image/png",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (!url.pathname.startsWith("/shishuo-xinyu/")) {
      res.writeHead(404).end();
      return;
    }
    const relative =
      decodeURIComponent(url.pathname.slice("/shishuo-xinyu/".length)) ||
      "index.html";
    const path = resolve(root, relative);
    if (!path.startsWith(root + sep)) {
      res.writeHead(403).end();
      return;
    }
    const body = await readFile(path);
    res
      .writeHead(200, { "Content-Type": types[extname(path)] || "text/plain" })
      .end(body);
  } catch {
    res.writeHead(404).end();
  }
}).listen(4173, "127.0.0.1");
