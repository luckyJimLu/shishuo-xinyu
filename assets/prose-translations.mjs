export function proseEntry(resource, work, index) {
  const e = resource?.entries?.[`${work.id}:${index + 1}`];
  if (
    !e ||
    e.status !== "reviewed" ||
    e.chapterId !== work.id ||
    e.entry !== index + 1 ||
    e.source !== work.content[index] ||
    !e.translation?.trim() ||
    (e.notes !== undefined &&
      (!Array.isArray(e.notes) ||
        e.notes.some(
          (n) =>
            !n.word ||
            !n.note?.trim() ||
            !Number.isInteger(n.start) ||
            !Number.isInteger(n.end) ||
            n.start < 0 ||
            n.end <= n.start ||
            e.source.slice(n.start, n.end) !== n.word,
        ))) ||
    !Array.isArray(e.segments) ||
    !e.segments.length ||
    e.segments.some(
      (s) => !s.source || !s.translation?.trim() || s.status !== "reviewed",
    ) ||
    e.segments.map((s) => s.source).join("") !== e.source ||
    e.segments.map((s) => s.translation).join("") !== e.translation
  )
    return null;
  return e;
}
export function validateProse(resource, works, bookId = "shishuo-xinyu") {
  if (
    resource?.schemaVersion !== 1 ||
    resource.bookId !== bookId ||
    !resource.entries
  )
    throw Error("正文译文格式无效");
  const expected = works.flatMap((w) =>
    w.content.map((_, i) => `${w.id}:${i + 1}`),
  );
  if (
    Object.keys(resource.entries).length !== expected.length ||
    expected.some((k) => !resource.entries[k])
  )
    throw Error("正文译文条目不完整");
  for (const w of works)
    for (let i = 0; i < w.content.length; i++) {
      const e = proseEntry(resource, w, i);
      if (
        !e ||
        !e.sources?.length ||
        !e.review?.checks?.length ||
        e.review.independentExpertReview !== false
      )
        throw Error(`正文译文需要复核：${w.title} ${i + 1}`);
      if (e.sources.some((s) => !s.title || !s.url?.startsWith("https://")))
        throw Error("译文来源不完整");
    }
  return resource;
}
export async function verifyProseHashes(resource) {
  await Promise.all(
    Object.values(resource.entries).map(async (e) => {
      const bytes = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(e.source),
      );
      const hash = Array.from(new Uint8Array(bytes), (b) =>
        b.toString(16).padStart(2, "0"),
      ).join("");
      if (hash !== e.sourceHash) throw Error("正文译文指纹失效，需重新复核");
    }),
  );
  return resource;
}
