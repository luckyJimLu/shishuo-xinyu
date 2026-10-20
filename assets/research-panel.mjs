import { externalLink, atlasRoute } from "./knowledge.mjs";
function node(tag, text, className) {
  const e = document.createElement(tag);
  if (text != null) e.textContent = text;
  if (className) e.className = className;
  return e;
}
function link(text, href, external = false) {
  const a = node("a", text);
  a.href = href;
  if (external) {
    a.target = "_blank";
    a.rel = "noopener noreferrer";
  }
  return a;
}
export function entityDetails(
  entity,
  mentions = [],
  { context = {}, notes = [], atlasLink = true } = {},
) {
  const content = node("div", null, "research-content");
  content.append(
    node("p", entity.type === "place" ? "地名研读" : "器物研读", "eyebrow"),
    node("h2", entity.name, "research-title"),
    node("p", entity.definition),
  );
  if (mentions.length) {
    content.append(node("h3", "本文语境"));
    for (const m of mentions)
      content.append(
        node("blockquote", m.text, "research-quote"),
        node("p", m.context, "research-context"),
        node(
          "p",
          "语境时期：" + m.period + " · " + m.bookTitle + " · " + m.title,
          "research-meta",
        ),
      );
  }
  for (const n of notes)
    content.append(node("p", n.word + "：" + n.note, "research-context"));
  if (entity.type === "place") {
    content.append(node("h3", "古今地理参考"), node("p", entity.modernName));
    const ids = new Set(mentions.map((m) => m.locationId));
    const locations = entity.locations.filter(
      (l) => !ids.size || ids.has(l.id),
    );
    if (locations.length)
      for (const location of locations)
        content.append(
          node(
            "p",
            location.precision + " · " + location.label,
            "research-meta",
          ),
          node("p", location.basis, "research-context"),
        );
    else
      content.append(
        node(
          "p",
          "定位待考：此地名保留在列表中，不强行落点。",
          "research-context",
        ),
      );
  }
  const actions = node("div", null, "research-actions");
  if (entity.type === "object")
    actions.append(
      link("Google 图片 · 器物检索 ↗", externalLink(entity), true),
    );
  else {
    const ids = new Set(mentions.map((m) => m.locationId));
    for (const location of entity.locations.filter(
      (l) => !ids.size || ids.has(l.id),
    ))
      actions.append(
        link(
          "Google 地图 · " +
            (entity.locations.length > 1 ? location.label : "今地检索") +
            " ↗",
          externalLink(entity, location.id),
          true,
        ),
      );
  }
  if (entity.type === "place" && atlasLink)
    actions.append(
      link("在文学地图中查看 →", atlasRoute({ ...context, place: entity.id })),
    );
  const copy = node("button", "复制检索词", "btn");
  copy.type = "button";
  const status = node("p", "", "copy-status");
  status.setAttribute("role", "status");
  copy.onclick = async () => {
    try {
      await navigator.clipboard.writeText(entity.searchQuery);
      status.textContent = "检索词已复制";
    } catch {
      status.textContent = "请选中下方检索词复制";
      const input = node("input");
      input.readOnly = true;
      input.value = entity.searchQuery;
      input.setAttribute("aria-label", "可复制的检索词");
      status.replaceChildren(node("span", "请选中下方检索词复制"), input);
      input.focus();
      input.select();
    }
  };
  actions.append(copy);
  content.append(actions, status, node("h3", "资料出处"));
  const sources = node("ul");
  for (const s of entity.sources) {
    const li = node("li");
    li.append(link(s.title + " ↗", s.url, true));
    sources.append(li);
  }
  content.append(
    sources,
    node(
      "p",
      "释义为本站整理；Google 仅作进一步检索，不作为词义或定位证据。",
      "research-meta",
    ),
  );
  return content;
}
export function createResearchPanel({ onLayoutChange }) {
  const panel = document.getElementById("researchPanel"),
    dialog = document.getElementById("researchDialog");
  const media = matchMedia("(max-width:820px)");
  let active = null,
    trigger = null,
    host = null;
  function close(returnFocus = true) {
    const old = trigger?.isConnected
      ? trigger
      : document.getElementById(trigger?.id || "");
    active = null;
    if (dialog.open) dialog.close();
    panel.hidden = true;
    panel.replaceChildren();
    dialog.replaceChildren();
    document.body.classList.remove("research-open");
    if (old?.isConnected) old.setAttribute("aria-expanded", "false");
    onLayoutChange();
    if (returnFocus && old?.isConnected) old.focus({ preventScroll: true });
  }
  function paint() {
    if (!active) return;
    panel.replaceChildren();
    dialog.replaceChildren();
    if (dialog.open) dialog.close();
    panel.hidden = true;
    const mobile = media.matches;
    host = mobile ? dialog : panel;
    const closeButton = node("button", "关闭", "btn research-close");
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "关闭名物研读");
    closeButton.onclick = () => close();
    const detail = entityDetails(
      active.entity,
      active.mentions,
      active.options,
    );
    detail.querySelector("h2").id = "researchTitle";
    detail.querySelector("h2").tabIndex = -1;
    host.setAttribute("aria-labelledby", "researchTitle");
    host.append(closeButton, detail);
    document.body.classList.toggle("research-open", !mobile);
    if (mobile) dialog.showModal();
    else panel.hidden = false;
    onLayoutChange();
    detail.querySelector("h2").focus({ preventScroll: true });
  }
  dialog.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const nodes = [
      ...dialog.querySelectorAll(
        'a[href],button:not([disabled]),input:not([disabled]),[tabindex="0"]',
      ),
    ].filter((n) => n.getClientRects().length);
    const first = nodes[0],
      last = nodes.at(-1);
    if (!first) {
      e.preventDefault();
      return;
    }
    if (
      e.shiftKey &&
      (document.activeElement === first ||
        !dialog.contains(document.activeElement))
    ) {
      e.preventDefault();
      last.focus();
    } else if (
      !e.shiftKey &&
      (document.activeElement === last ||
        !dialog.contains(document.activeElement))
    ) {
      e.preventDefault();
      first.focus();
    }
  });
  dialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    close();
  });
  media.addEventListener("change", () => {
    if (active) paint();
  });
  return {
    open(entity, mentions, button, options = {}) {
      if (trigger?.isConnected) trigger.setAttribute("aria-expanded", "false");
      active = { entity, mentions, options };
      trigger = button;
      if (trigger?.isConnected) trigger.setAttribute("aria-expanded", "true");
      paint();
    },
    close,
    isOpen() {
      return !!active;
    },
  };
}
