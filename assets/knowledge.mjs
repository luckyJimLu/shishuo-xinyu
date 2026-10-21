import { readingRoute } from "./library.mjs";
export const PERIODS = ["汉", "三国", "两晋", "南北朝", "唐", "宋", "待考"];
export function externalLink(entity, locationId = null) {
  const url = new URL(
    entity.type === "place"
      ? "https://www.google.com/maps/search/"
      : "https://www.google.com/search",
  );
  if (entity.type === "place") url.searchParams.set("api", "1");
  else url.searchParams.set("tbm", "isch");
  url.searchParams.set(
    entity.type === "place" ? "query" : "q",
    entity.locations?.find((l) => l.id === locationId)?.searchQuery ||
      entity.searchQuery,
  );
  return url.href;
}
export function mentionRoute(mention) {
  return (
    readingRoute(mention.bookId, mention.workId) +
    "?" +
    new URLSearchParams({ mention: mention.id })
  );
}
export function atlasRoute(filters = {}) {
  const params = new URLSearchParams();
  for (const key of [
    "book",
    "view",
    "period",
    "q",
    "place",
    "scope",
    "contextBook",
    "work",
  ])
    if (filters[key] && !(key === "scope" && filters[key] === "all"))
      params.set(key, filters[key]);
  return "#/atlas" + (params.size ? "?" + params : "");
}
export function safeMentions(data, bookId, workId, entry, text) {
  return data.mentions.filter(
    (m) =>
      m.status === "reviewed" &&
      m.bookId === bookId &&
      m.workId === workId &&
      m.entry === entry &&
      m.text === text &&
      Number.isInteger(m.start) &&
      Number.isInteger(m.end) &&
      m.start >= 0 &&
      m.end > m.start &&
      text.slice(m.start, m.end) === m.surface,
  );
}
export function mergedSpans(text, notes, mentions) {
  const ranges = [];
  for (const [j, n] of notes.entries()) {
    if (!n.word) continue;
    const at = Number.isInteger(n.start) ? n.start : text.indexOf(n.word);
    if (at >= 0 && text.slice(at, at + n.word.length) === n.word)
      ranges.push({
        start: at,
        end: at + n.word.length,
        notes: [{ ...n, index: j }],
        mentions: [],
      });
  }
  for (const m of mentions)
    ranges.push({ start: m.start, end: m.end, notes: [], mentions: [m] });
  ranges.sort((a, b) => a.start - b.start || b.end - a.end);
  const result = [];
  for (const range of ranges) {
    const prev = result.at(-1);
    if (prev && range.start < prev.end) {
      prev.end = Math.max(prev.end, range.end);
      prev.notes.push(...range.notes);
      prev.mentions.push(...range.mentions);
    } else result.push({ ...range });
  }
  return result;
}
export function atlasPlaces(entities, data, filters = {}) {
  const q = (filters.q || "").trim().toLowerCase();
  const rows = data.mentions.filter(
    (m) =>
      m.status === "reviewed" &&
      (!filters.book || m.bookId === filters.book) &&
      (!filters.period || m.period === filters.period) &&
      (filters.scope !== "current" ||
        (m.bookId === filters.contextBook && m.workId === filters.work)),
  );
  return entities.entities
    .filter((e) => e.type === "place")
    .map((entity) => ({
      entity,
      mentions: rows.filter((m) => m.entityId === entity.id),
    }))
    .filter(
      ({ entity, mentions }) =>
        mentions.length &&
        (!q ||
          [entity.name, entity.modernName, ...entity.aliases]
            .join(" ")
            .toLowerCase()
            .includes(q)),
    );
}
export function relatedWorks(mentions = []) {
  const groups = new Map();
  for (const m of mentions) {
    if (m.status !== "reviewed") continue;
    const key = JSON.stringify([m.bookId, m.workId]);
    if (!groups.has(key))
      groups.set(key, {
        bookId: m.bookId,
        workId: m.workId,
        bookTitle: m.bookTitle,
        title: m.title,
        mentions: [],
      });
    groups.get(key).mentions.push(m);
  }
  return [...groups.values()];
}
export function markerGroups(places) {
  const groups = new Map();
  for (const place of places)
    for (const m of place.mentions) {
      const location = place.entity.locations.find(
        (l) => l.id === m.locationId,
      );
      if (!location) continue;
      const key = location.coordinates.join(",");
      if (!groups.has(key))
        groups.set(key, {
          coordinates: location.coordinates,
          places: [],
          mentions: [],
        });
      const group = groups.get(key);
      if (!group.places.some((p) => p.entity.id === place.entity.id))
        group.places.push(place);
      group.mentions.push(m);
    }
  return [...groups.values()];
}
export function validateKnowledge(entities, data) {
  if (
    !entities ||
    !Array.isArray(entities.entities) ||
    !data ||
    !Array.isArray(data.mentions)
  )
    throw Error("名物资料格式不正确");
  const ids = new Set();
  for (const e of entities.entities) {
    if (
      !/^[-a-z0-9]+$/.test(e.id || "") ||
      ids.has(e.id) ||
      !e.name ||
      !["place", "object"].includes(e.type) ||
      !e.definition ||
      !e.searchQuery ||
      !e.sources?.length
    )
      throw Error("词条资料不完整");
    ids.add(e.id);
    for (const s of e.sources)
      if (!s.title || !/^https:\/\//.test(s.url)) throw Error("资料出处不合法");
    if (e.type === "place" && !Array.isArray(e.locations))
      throw Error("地名位置资料不完整");
    if (e.type === "place")
      for (const l of e.locations || [])
        if (
          !Array.isArray(l.coordinates) ||
          l.coordinates.length !== 2 ||
          !l.coordinates.every(Number.isFinite) ||
          Math.abs(l.coordinates[0]) > 180 ||
          Math.abs(l.coordinates[1]) > 90 ||
          !l.basis ||
          !l.source ||
          !l.precision
        )
          throw Error("参考位置不合法");
  }
  const mid = new Set();
  for (const m of data.mentions) {
    if (
      !/^m-[a-f0-9]{14}$/.test(m.id || "") ||
      mid.has(m.id) ||
      !ids.has(m.entityId) ||
      !["reviewed", "excluded", "pending", "candidate"].includes(m.status) ||
      !PERIODS.includes(m.period)
    )
      throw Error("词例资料不合法");
    mid.add(m.id);
    if (
      m.status === "reviewed" &&
      (!m.reviewer ||
        !m.context ||
        !Number.isInteger(m.start) ||
        !Number.isInteger(m.end) ||
        m.start < 0 ||
        m.end <= m.start ||
        m.text.slice(m.start, m.end) !== m.surface)
    )
      throw Error("已发布词例范围或复核资料不合法");
    const entity = entities.entities.find((e) => e.id === m.entityId);
    if (m.locationId && !entity.locations?.some((l) => l.id === m.locationId))
      throw Error("未知参考位置");
  }
  return true;
}
let cached;
export async function loadKnowledge() {
  if (!cached)
    cached = Promise.all(
      ["knowledge-entities.json", "knowledge-mentions.json"].map(
        async (path) => {
          const r = await fetch("./data/" + path, {
            signal: AbortSignal.timeout(15000),
          });
          if (!r.ok) throw Error("名物资料 HTTP " + r.status);
          return r.json();
        },
      ),
    )
      .then(([entities, mentions]) => {
        validateKnowledge(entities, mentions);
        return { entities, mentions };
      })
      .catch((e) => {
        cached = null;
        throw e;
      });
  return cached;
}
