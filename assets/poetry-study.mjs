// Original-text equality is also checked at render time, after asynchronous loads.
export function studyLine(resource, work, index) {
  const poem = resource?.poems?.[work.id];
  const line = poem?.lines?.[index];
  if (
    poem?.status !== "reviewed" ||
    poem.title !== work.title ||
    poem.author !== work.author ||
    line?.status !== "reviewed" ||
    line.source !== work.content[index] ||
    typeof line.translation !== "string" ||
    !line.translation.trim()
  )
    return null;
  if (
    !Array.isArray(line.notes) ||
    line.notes.some(
      (n) =>
        !n ||
        typeof n.word !== "string" ||
        typeof n.note !== "string" ||
        !Number.isInteger(n.start) ||
        !Number.isInteger(n.end) ||
        n.start < 0 ||
        n.end <= n.start ||
        line.source.slice(n.start, n.end) !== n.word ||
        !n.note?.trim(),
    )
  )
    return null;
  return line;
}
export function validateStudy(resource, works, bookId = "tang-poems") {
  if (
    resource?.schemaVersion !== 1 ||
    resource.bookId !== bookId ||
    !resource.poems
  )
    throw Error("诗词注译格式无效");
  const ids = new Set(works.map((w) => w.id));
  if (
    Object.keys(resource.poems).length !== works.length ||
    Object.keys(resource.poems).some((id) => !ids.has(id))
  )
    throw Error("诗词注译篇目不完整");
  for (const work of works) {
    const p = resource.poems[work.id];
    if (
      !p ||
      p.lines?.length !== work.content.length ||
      !p.sources?.length ||
      !p.editorialNote ||
      !p.lines.some((l) => l.notes?.length)
    )
      throw Error("诗词注译缺漏：" + work.title);
    for (let i = 0; i < work.content.length; i++)
      if (!studyLine(resource, work, i))
        throw Error("诗词注译需要复核：" + work.title + " 第" + (i + 1) + "行");
    for (const s of p.sources)
      if (!s.title || !s.url?.startsWith("https://"))
        throw Error("诗词参考资料无效");
  }
  return resource;
}

export async function verifyStudyHashes(resource) {
  const encoder = new TextEncoder();
  await Promise.all(
    Object.values(resource.poems || {}).flatMap((p) =>
      (p.lines || []).map(async (line) => {
        const bytes = await crypto.subtle.digest(
          "SHA-256",
          encoder.encode(line.source),
        );
        const hash = Array.from(new Uint8Array(bytes), (b) =>
          b.toString(16).padStart(2, "0"),
        ).join("");
        if (hash !== line.sourceHash)
          throw Error("诗词注译指纹失效，需重新复核");
      }),
    ),
  );
  return resource;
}
