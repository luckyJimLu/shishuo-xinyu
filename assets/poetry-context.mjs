export function contextEntry(resource, work) {
  const e = resource?.works?.[work.id];
  if (
    !e ||
    e.id !== work.id ||
    e.status !== "reviewed" ||
    e.title !== work.title ||
    e.author !== work.author ||
    JSON.stringify(e.source) !== JSON.stringify(work.content) ||
    typeof e.background !== "string" ||
    !e.background.trim() ||
    typeof e.mood !== "string" ||
    !e.mood.trim() ||
    !e.evidence ||
    !work.content.join("").includes(e.evidence)
  )
    return null;
  return e;
}
export function validateContext(resource, works) {
  if (
    resource?.schemaVersion !== 1 ||
    resource.bookId !== "tang-poems" ||
    !resource.works ||
    Object.keys(resource.works).length !== works.length
  )
    throw Error("唐诗背景资料不完整");
  for (const w of works) {
    const e = contextEntry(resource, w);
    if (
      !e ||
      !e.sources?.length ||
      !e.review?.checks?.length ||
      e.review.independentExpertReview !== false ||
      e.sources.some((s) => !s.title || !s.url?.startsWith("https://"))
    )
      throw Error("唐诗背景需要复核：" + w.title);
  }
  return resource;
}
export async function verifyContextHashes(resource) {
  await Promise.all(
    Object.values(resource.works).map(async (e) => {
      const value = JSON.stringify({
        id: e.id,
        title: e.title,
        author: e.author,
        content: e.source,
      });
      const bytes = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(value),
      );
      const hash = Array.from(new Uint8Array(bytes), (b) =>
        b.toString(16).padStart(2, "0"),
      ).join("");
      if (hash !== e.sourceHash) throw Error("唐诗背景原文指纹失效");
    }),
  );
  return resource;
}
