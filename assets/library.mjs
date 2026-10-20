// Shared by the browser and data checks. Adding a book never changes reader routing.
export const LEGACY_BOOK = "shishuo-xinyu";
export function validateCatalog(data) {
  if (!data || !Array.isArray(data.books) || !data.books.length)
    throw Error("书库目录为空");
  const ids = new Set();
  for (const b of data.books) {
    if (
      !b ||
      !/^[-a-z0-9]+$/.test(b.id) ||
      ids.has(b.id) ||
      !b.title ||
      !["prose", "poetry"].includes(b.kind) ||
      !/^[-a-z0-9]+\.json$/.test(b.path)
    )
      throw Error("书目格式不正确");
    ids.add(b.id);
  }
  return data.books;
}
export function adaptBook(meta, data) {
  const articles = data?.articles;
  if (!Array.isArray(articles) || !articles.length)
    throw Error("未识别正文数据结构");
  const seen = new Set();
  return articles.map((ch, i) => {
    const id =
      meta.kind === "prose"
        ? `chapter-${String(i + 1).padStart(2, "0")}`
        : ch.id;
    if (
      !id ||
      seen.has(id) ||
      typeof ch.title !== "string" ||
      !ch.title.trim() ||
      !Array.isArray(ch.content) ||
      !ch.content.length ||
      !ch.content.every((t) => typeof t === "string" && t.trim()) ||
      (meta.kind === "poetry" && (!ch.author || typeof ch.author !== "string"))
    )
      throw Error("篇目格式不正确");
    seen.add(id);
    return { ...ch, id };
  });
}
export function findWorks(articles, query) {
  const q = query.trim().toLocaleLowerCase("zh-CN");
  return articles
    .map((work, index) => ({ work, index }))
    .filter(
      ({ work }) =>
        !q ||
        [work.title, work.author || "", work.genre || "", ...work.content].some(
          (s) => s.toLocaleLowerCase("zh-CN").includes(q),
        ),
    );
}
export function bookRoute(id) {
  return "#/book/" + encodeURIComponent(id);
}
export function readingRoute(id, workId) {
  return bookRoute(id) + "/read/" + encodeURIComponent(workId);
}
export function parseRoute(hash) {
  const [path, search = ""] = (hash || "").split("?");
  const params = new URLSearchParams(search);
  if (!path || path === "#/" || path === "#") return { view: "library" };
  if (path === "#/atlas")
    return { view: "atlas", filters: Object.fromEntries(params) };
  try {
    let m = path.match(/^#\/chapter\/(.+)$/);
    if (m)
      return {
        view: "legacy",
        bookId: LEGACY_BOOK,
        title: decodeURIComponent(m[1]),
      };
    m = path.match(/^#\/book\/([^/]+)(?:\/read\/([^/]+))?$/);
    if (m) {
      const result = {
        view: m[2] ? "reading" : "book",
        bookId: decodeURIComponent(m[1]),
        workId: m[2] ? decodeURIComponent(m[2]) : null,
      };
      if (params.has("mention")) result.mentionId = params.get("mention");
      return result;
    }
  } catch {}
  return { view: "missing" };
}
export function storageKey(bookId, type) {
  return `classics:${bookId}:${type}`;
}
