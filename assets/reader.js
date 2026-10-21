import {
  contextEntry,
  validateContext,
  verifyContextHashes,
} from "./poetry-context.mjs";
import {
  proseEntry,
  validateProse,
  verifyProseHashes,
} from "./prose-translations.mjs";
("use strict");
import {
  studyLine,
  validateStudy,
  verifyStudyHashes,
} from "./poetry-study.mjs";
import {
  validateCatalog,
  adaptBook,
  findWorks,
  bookRoute,
  readingRoute,
  parseRoute,
  storageKey,
  LEGACY_BOOK,
} from "./library.mjs";
import {
  loadKnowledge,
  safeMentions,
  mergedSpans,
  atlasRoute,
} from "./knowledge.mjs";
import { createResearchPanel } from "./research-panel.mjs";
let knowledgeData = null,
  knowledgeLoading = false,
  knowledgeError = "",
  forcedMention = null,
  pendingMention = null,
  atlasController = null,
  researchController = null;
const SITE_TITLE = "中国古典文学";
let optionalEpoch = -1;
let catalog = [],
  activeBook = null,
  view = "library",
  routeVersion = 0,
  bookEpoch = 0,
  routeHash = null,
  listLimit = 40,
  genreFilter = "";
const bookCache = new Map();
const $ = (s) => document.querySelector(s);
const LS = {
  theme: "ssxy_theme",
  fs: "ssxy_fs",
  dir: "ssxy_dir",
  notes: "ssxy_notes",
  trans: "ssxy_trans",
  knowledge: "classics:knowledge",
  chapter: "ssxy_chapter",
  pos: "ssxy_pos",
};
const memory = {};
const prefs = {
  get(key) {
    try {
      return localStorage.getItem(key) ?? memory[key] ?? null;
    } catch {
      return memory[key] ?? null;
    }
  },
  set(key, value) {
    memory[key] = String(value);
    try {
      localStorage.setItem(key, String(value));
    } catch {
      /* Reading remains available when storage is blocked. */
    }
  },
};
let book = [],
  current = -1,
  query = "",
  notesData = {},
  translationsData = {},
  contextData = {},
  liuData = {},
  positions = {},
  restoring = false,
  searchAnchor = null,
  saveTimer;
const failed = new Set();
let studyLoadingEpoch = -1;
let contextLoadingEpoch = -1;
const openContexts = new Set();
const openContextSources = new Set();
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const vertical = () => $("#reader").classList.contains("vertical");
async function json(path) {
  const r = await fetch("./data/" + path, {
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw Error("HTTP " + r.status);
  const value = await r.json();
  if (!value || typeof value !== "object") throw Error("数据格式不正确");
  return value;
}
function status() {
  $("#loadStatus").innerHTML = failed.size
    ? `${[...failed].map((x) => esc(x.label)).join("、")}加载失败，正文仍可阅读。<button class="btn" id="retryOptional">重试</button>`
    : "";
  const loadingStudy = studyLoadingEpoch === bookEpoch;
  for (const id of ["notesBtn", "transBtn"])
    $("#" + id).setAttribute("aria-busy", String(loadingStudy));
  if (
    loadingStudy &&
    view === "reading" &&
    (prefs.get(LS.notes) === "on" || prefs.get(LS.trans) === "on")
  )
    $("#loadStatus").append(
      document.createTextNode(
        activeBook?.kind === "poetry"
          ? "正在加载唐诗注译，正文可先阅读…"
          : "正在加载正文译文，正文可先阅读…",
      ),
    );
  if (contextLoadingEpoch === bookEpoch && view === "reading")
    $("#loadStatus").append(
      document.createTextNode(" 正在加载创作背景，正文可先阅读…"),
    );
  if (knowledgeLoading && view === "reading")
    $("#loadStatus").append(document.createTextNode(" 正在加载名物资料…"));
  if (knowledgeError && view === "reading") {
    $("#loadStatus").append(
      document.createTextNode(" " + knowledgeError + "，正文仍可阅读。"),
    );
    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "btn";
    retry.textContent = "重试名物";
    retry.id = "retryKnowledge";
    retry.onclick = () => prepareKnowledge();
    $("#loadStatus").append(retry);
  }
  if ($("#retryOptional"))
    $("#retryOptional").onclick = () => loadOptional([...failed]);
}
async function loadOptional(items = activeBook?.resources || []) {
  const id = activeBook?.id,
    epoch = bookEpoch;
  if (
    items.some((item) =>
      ["poetry-study", "prose-translations"].includes(item.type),
    )
  ) {
    studyLoadingEpoch = epoch;
    status();
  }
  if (items.some((item) => item.type === "poetry-context")) {
    contextLoadingEpoch = epoch;
    status();
  }
  const retry = $("#retryOptional");
  if (retry) {
    retry.disabled = true;
    retry.textContent = "重试中…";
  }
  await Promise.all(
    items.map(async (item) => {
      try {
        const data = await json(item.path);
        if (
          item.type === "liu" &&
          (!data.notes || typeof data.notes !== "object")
        )
          throw Error("缺少注文");
        if (activeBook?.id !== id || epoch !== bookEpoch) return;
        if (item.type === "poetry-study") {
          validateStudy(data, book);
          await verifyStudyHashes(data);
          if (activeBook?.id !== id || epoch !== bookEpoch) return;
          notesData = translationsData = data;
        }
        if (item.type === "prose-translations") {
          validateProse(data, book);
          await verifyProseHashes(data);
          if (activeBook?.id !== id || epoch !== bookEpoch) return;
          translationsData = data;
        }
        if (item.type === "poetry-context") {
          validateContext(data, book);
          await verifyContextHashes(data);
          if (activeBook?.id !== id || epoch !== bookEpoch) return;
          contextData = data;
        }
        if (item.type === "annotations") notesData = data;
        if (item.type === "translations") translationsData = data;
        if (item.type === "liu") liuData = data.notes;
        failed.delete(item);
      } catch {
        if (activeBook?.id === id && epoch === bookEpoch) failed.add(item);
      }
    }),
  );
  if (activeBook?.id !== id || epoch !== bookEpoch) return;
  studyLoadingEpoch = -1;
  contextLoadingEpoch = -1;
  const anchor = capture();
  status();
  if (view === "reading") renderChapter(anchor);
}
function readPositions(meta) {
  let value = {};
  try {
    value = JSON.parse(prefs.get(storageKey(meta.id, "positions")) || "{}");
  } catch {}
  if (!value || typeof value !== "object" || Array.isArray(value)) value = {};
  if (meta.id === LEGACY_BOOK && !prefs.get(storageKey(meta.id, "positions"))) {
    try {
      const legacy = JSON.parse(prefs.get(LS.pos) || "{}");
      for (const ch of book)
        if (legacy[ch.title]) value[ch.id] = legacy[ch.title];
    } catch {}
  }
  return value;
}
async function init() {
  researchController = createResearchPanel({
    onLayoutChange() {
      if (view === "reading") {
        const anchor = capture();
        if (anchor) restore(anchor);
      }
    },
  });
  restorePrefs();
  bind();
  try {
    catalog = validateCatalog(await json("catalog.json"));
    await route();
  } catch (e) {
    setView("library");
    $("#content").innerHTML =
      `<div class="empty">书库加载失败：${esc(e.message)}<br><button id="retryCatalog" class="btn">重新加载书库</button></div>`;
    $("#retryCatalog").onclick = () => location.reload();
  }
}
function setView(next) {
  view = next;
  document.body.dataset.view = next;
  const reading = next === "reading";
  $("#side").hidden = !reading;
  $("#menuBtn").hidden = !reading;
  if (!reading) toggleSide(false);
  else
    $("#side").inert =
      matchMedia("(max-width:820px)").matches &&
      !$("#side").classList.contains("open");
  $(".main").classList.toggle("atlas-view", next === "atlas");
  $("#knowledgeBtn").hidden = next !== "reading";
  $("#knowledgeBtn").setAttribute("aria-pressed", String(termsEnabled()));
  $("#atlasLink").href = atlasRoute(researchContext());
  $(".main").classList.toggle("library-view", next === "library");
  $(".main").classList.toggle(
    "overview-view",
    next === "book" || next === "search",
  );
  $("#reader").classList.toggle(
    "vertical",
    next === "reading" && prefs.get(LS.dir) === "v",
  );
  for (const id of ["minusBtn", "plusBtn", "dirBtn"])
    $("#" + id).hidden = next !== "reading";
  for (const id of ["notesBtn", "transBtn"])
    $("#" + id).hidden =
      next !== "reading" ||
      !activeBook?.resources?.some(
        (r) =>
          r.type === "poetry-study" ||
          (id === "transBtn" && r.type === "prose-translations") ||
          r.type === (id === "notesBtn" ? "annotations" : "translations"),
      );
  $("#loadStatus").hidden = next === "library";
  $("#search").placeholder =
    next === "atlas"
      ? "检索古今地名…"
      : next === "library"
        ? "检索藏书…"
        : activeBook?.kind === "poetry"
          ? "检索诗题、作者、诗句…"
          : next === "reading"
            ? "检索当前篇正文…"
            : "检索篇目与正文…";
  $("#search").setAttribute(
    "aria-label",
    $("#search").placeholder.replace("…", ""),
  );
  updateProgress();
}
function chapterURL(i) {
  return readingRoute(activeBook.id, book[i].id);
}
async function route() {
  savePosition();
  researchController?.close(false);
  atlasController?.destroy();
  atlasController = null;
  forcedMention = null;
  pendingMention = null;
  clearTimeout(saveTimer);
  const version = ++routeVersion;
  routeHash = location.hash;
  const destination = parseRoute(location.hash);
  clearQuery();
  listLimit = 40;
  genreFilter = "";
  current = -1;
  if (destination.view === "atlas") {
    setView("atlas");
    toggleSide(false);
    document.title = "文学地名地图 · " + SITE_TITLE;
    $("#loadStatus").hidden = true;
    const { mountAtlas } = await import("./atlas.mjs");
    if (version !== routeVersion) return;
    const controller = await mountAtlas($("#content"), {
      catalog,
      filters: destination.filters,
      context: researchContext(),
      isCurrent: () => version === routeVersion,
      onURLChange() {
        routeHash = location.hash;
      },
    });
    if (version !== routeVersion) {
      controller.destroy();
      return;
    }
    atlasController = controller;
    $("#search").value = destination.filters.q || "";
    $("#clearSearch").hidden = !$("#search").value;
    return;
  }
  if (destination.view === "library") {
    showHome();
    return;
  }
  const meta = catalog.find((b) => b.id === destination.bookId);
  if (!meta || destination.view === "missing") {
    showMissing();
    return;
  }
  const changed = activeBook?.id !== meta.id;
  if (changed) {
    activeBook = meta;
    book = [];
    positions = {};
    notesData = {};
    translationsData = {};
    contextData = {};
    liuData = {};
    failed.clear();
    bookEpoch++;
  }
  setView("book");
  toggleSide(false);
  $("#navTitle").textContent = meta.title;
  $("#total").textContent = "";
  $("#bookNav").innerHTML = ``;
  $("#chapters").innerHTML = "";
  $("#loadStatus").innerHTML = "";
  $("#content").innerHTML =
    '<div class="empty" role="status">正在打开《' +
    esc(meta.title) +
    "》…</div>";
  document.title = meta.title + " · " + SITE_TITLE;
  try {
    if (!bookCache.has(meta.id))
      bookCache.set(
        meta.id,
        json(meta.path)
          .then((data) => adaptBook(meta, data))
          .catch((e) => {
            bookCache.delete(meta.id);
            throw e;
          }),
      );
    const articles = await bookCache.get(meta.id);
    if (version !== routeVersion) return;
    book = articles;
    positions = readPositions(meta);
    renderNav();
    $("#total").textContent = book.length + " " + (meta.sectionUnit || "篇");
    if (destination.view === "legacy") {
      const i = book.findIndex((ch) => ch.title === destination.title);
      if (i < 0) {
        showMissing();
        return;
      }
      history.replaceState(null, "", chapterURL(i));
      routeHash = location.hash;
      openChapter(i);
    } else if (destination.view === "reading") {
      const i = book.findIndex((ch) => ch.id === destination.workId);
      if (i < 0) {
        showMissing();
        return;
      }
      forcedMention = destination.mentionId || null;
      pendingMention = forcedMention;
      openChapter(i);
    } else renderBookOverview();
    if (optionalEpoch !== bookEpoch) {
      optionalEpoch = bookEpoch;
      void loadOptional();
    } else status();
  } catch (e) {
    if (version !== routeVersion) return;
    $("#content").innerHTML =
      `<div class="empty">《${esc(meta.title)}》正文加载失败：${esc(e.message)}<br><button id="retryBook" class="btn">重新加载</button></div>`;
    $("#retryBook").onclick = () => route();
  }
}
function showMissing() {
  setView("library");
  current = -1;
  activeBook = null;
  bookEpoch++;
  failed.clear();
  $("#loadStatus").innerHTML = "";
  document.title = "篇目未找到 · " + SITE_TITLE;
  $("#content").innerHTML = '<div class="empty">未找到此书或此篇。</div>';
  updateNav();
}
function navigate(i) {
  savePosition();
  history.pushState(null, "", i < 0 ? "#/" : chapterURL(i));
  void route();
}
function applySearch() {
  if (!query) searchAnchor = capture();
  query = $("#search").value.trim();
  $("#clearSearch").hidden = !query;
  listLimit = 40;
  if (view === "atlas") {
    atlasController?.search(query);
    return;
  }
  if (view === "library") {
    renderLibrary();
    return;
  }
  if (activeBook?.kind === "prose" && current >= 0) {
    renderChapter(query ? null : searchAnchor);
    return;
  }
  if (!query && current >= 0) {
    renderChapter(searchAnchor);
    return;
  }
  renderBookOverview();
}
function termsEnabled() {
  return prefs.get(LS.knowledge) === "on" || Boolean(forcedMention);
}
function researchContext() {
  if (activeBook && current >= 0)
    return { contextBook: activeBook.id, work: book[current].id };
  try {
    const recent = JSON.parse(prefs.get("classics:lastRead"));
    if (recent?.bookId && recent.workId)
      return { contextBook: recent.bookId, work: recent.workId };
  } catch {}
  return {};
}
async function prepareKnowledge() {
  if (knowledgeData) {
    if (view === "reading") renderChapter(capture());
    return;
  }
  if (knowledgeLoading) return;
  knowledgeLoading = true;
  knowledgeError = "";
  status();
  try {
    knowledgeData = await loadKnowledge();
  } catch {
    knowledgeError = "名物资料加载失败";
  } finally {
    knowledgeLoading = false;
    status();
    if (knowledgeData && view === "reading" && termsEnabled())
      renderChapter(capture());
  }
}
function openResearch(ids, button, notes = []) {
  if (!knowledgeData || !activeBook || current < 0) return;
  const mentions = knowledgeData.mentions.mentions.filter(
    (m) =>
      ids.includes(m.id) &&
      m.status === "reviewed" &&
      m.bookId === activeBook.id &&
      m.workId === book[current].id,
  );
  if (!mentions.length) return;
  const entity = knowledgeData.entities.entities.find(
    (e) => e.id === mentions[0].entityId,
  );
  if (!entity) return;
  const anchor = capture();
  researchController.open(
    entity,
    mentions.filter((m) => m.entityId === entity.id),
    button,
    { context: researchContext(), notes },
  );
  if (anchor) restore(anchor);
}
function followMention() {
  if (!pendingMention || !knowledgeData) return;
  const id = pendingMention;
  pendingMention = null;
  const button = [...document.querySelectorAll("[data-mention-ids]")].find(
    (b) => b.dataset.mentionIds.split(" ").includes(id),
  );
  if (!button) return;
  button.classList.add("term-target");
  requestAnimationFrame(() => {
    if (!button.isConnected) return;
    const r = $("#reader"),
      a = button.getBoundingClientRect(),
      b = r.getBoundingClientRect();
    r.scrollBy({
      top: vertical() ? 0 : a.top - b.top - 65,
      left: vertical() ? a.right - b.right + 50 : 0,
      behavior: "instant",
    });
    openResearch([id], button);
    button.focus({ preventScroll: true });
    updateProgress();
  });
}
function bind() {
  $("#knowledgeBtn").onclick = () => {
    const anchor = capture();
    const enable = !termsEnabled();
    forcedMention = null;
    pendingMention = null;
    prefs.set(LS.knowledge, enable ? "on" : "off");
    researchController.close();
    if (enable && !knowledgeData) void prepareKnowledge();
    renderChapter(anchor);
  };
  $("#menuBtn").onclick = () =>
    toggleSide(!$("#side").classList.contains("open"));
  $("#scrim").onclick = () => toggleSide(false);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && $("#side").classList.contains("open")) {
      toggleSide(false);
      $("#menuBtn").focus();
    }
  });
  $("#homeBtn").onclick = () => navigate(-1);
  $("#minusBtn").onclick = () => changeLayout(() => setFs(curFs() - 1));
  $("#plusBtn").onclick = () => changeLayout(() => setFs(curFs() + 1));
  for (const [id, key] of [
    ["notesBtn", LS.notes],
    ["transBtn", LS.trans],
  ])
    $("#" + id).onclick = () => {
      const anchor = capture();
      prefs.set(key, prefs.get(key) === "on" ? "off" : "on");
      syncBtns();
      status();
      if (view === "reading") renderChapter(anchor);
    };
  $("#themeBtn").onclick = () => {
    prefs.set(LS.theme, prefs.get(LS.theme) === "dark" ? "light" : "dark");
    document.documentElement.classList.toggle(
      "dark",
      prefs.get(LS.theme) === "dark",
    );
    syncBtns();
  };
  $("#dirBtn").onclick = () =>
    changeLayout(() => {
      prefs.set(LS.dir, vertical() ? "h" : "v");
      $("#reader").classList.toggle("vertical", prefs.get(LS.dir) === "v");
      syncBtns();
    });
  $("#search").addEventListener("input", (e) => {
    if (!e.isComposing) applySearch();
  });
  $("#search").addEventListener("compositionend", applySearch);
  $("#clearSearch").onclick = () => {
    $("#search").value = "";
    applySearch();
    $("#search").focus();
  };
  $("#reader").addEventListener(
    "scroll",
    () => {
      updateProgress();
      if (!restoring) {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(savePosition, 150);
      }
    },
    { passive: true },
  );
  $("#topBtn").onclick = () => {
    $("#reader").scrollTo({
      top: 0,
      left: 0,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  };
  $("#content").addEventListener("toggle", updateProgress, true);
  $("#content").addEventListener("click", (e) => {
    const term = e.target.closest("[data-mention-ids]");
    if (term) {
      let notes = [];
      try {
        notes = JSON.parse(term.dataset.extraNotes || "[]");
      } catch {}
      openResearch(term.dataset.mentionIds.split(" "), term, notes);
      return;
    }
    const a = e.target.closest(".annotated");
    if (a) {
      const p = document.getElementById(a.getAttribute("aria-controls"));
      p.hidden = !p.hidden;
      a.setAttribute("aria-expanded", String(!p.hidden));
    }
  });
  window.addEventListener("popstate", () => void route());
  window.addEventListener("hashchange", () => {
    if (location.hash !== routeHash) void route();
  });
  window.addEventListener("pagehide", savePosition);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) savePosition();
  });
  new ResizeObserver(() => {
    const anchor = capture();
    document.documentElement.style.setProperty(
      "--top-height",
      $(".top").offsetHeight + "px",
    );
    if (view === "reading" && anchor) restore(anchor);
  }).observe($(".top"));
  matchMedia("(max-width:820px)").addEventListener("change", () =>
    toggleSide(false),
  );
}
function restorePrefs() {
  document.documentElement.classList.toggle(
    "dark",
    prefs.get(LS.theme) === "dark",
  );
  setFs(Number.parseInt(prefs.get(LS.fs) || "20", 10), true);
  $("#reader").classList.toggle("vertical", prefs.get(LS.dir) === "v");
  syncBtns();
}
function setFs(v, silent = false) {
  v = Math.max(15, Math.min(30, v || 20));
  document.documentElement.style.setProperty("--fs", v + "px");
  if (!silent) prefs.set(LS.fs, v);
}
function curFs() {
  return (
    parseInt(
      getComputedStyle(document.documentElement).getPropertyValue("--fs"),
      10,
    ) || 20
  );
}
function syncBtns() {
  for (const [id, key] of [
    ["notesBtn", LS.notes],
    ["transBtn", LS.trans],
    ["dirBtn", LS.dir],
  ]) {
    const on = prefs.get(key) === (id === "dirBtn" ? "v" : "on");
    $("#" + id).classList.toggle("on", on);
    $("#" + id).setAttribute("aria-pressed", String(on));
  }
  $("#themeBtn").textContent = prefs.get(LS.theme) === "dark" ? "☀" : "☾";
}
function changeLayout(change) {
  const anchor = capture();
  change();
  if (view === "reading") restore(anchor);
}
function renderNav() {
  $("#bookNav").innerHTML =
    `<a href="${bookRoute(activeBook.id)}">${esc(activeBook.title)} · 全部篇目</a>`;
  $("#chapters").innerHTML = book
    .map(
      (ch, i) =>
        `<button class="chapter" data-chapter="${i}"><span class="num">${String(i + 1).padStart(2, "0")}</span><span class="chapter-body">${esc(ch.title)}${ch.author ? `<small>${esc(ch.author)}</small>` : ""}</span>${activeBook.kind === "prose" ? `<span class="count">${ch.content.length}</span>` : ""}</button>`,
    )
    .join("");
  $("#chapters").onclick = (e) => {
    const b = e.target.closest("[data-chapter]");
    if (b) navigate(Number(b.dataset.chapter));
  };
}
function updateNav() {
  document.querySelectorAll(".chapter").forEach((el, i) => {
    el.classList.toggle("active", i === current);
    if (i === current) el.setAttribute("aria-current", "page");
    else el.removeAttribute("aria-current");
  });
}
function clearQuery() {
  query = "";
  searchAnchor = null;
  $("#search").value = "";
  $("#clearSearch").hidden = true;
}
function showHome() {
  current = -1;
  activeBook = null;
  book = [];
  bookEpoch++;
  failed.clear();
  notesData = {};
  translationsData = {};
  contextData = {};
  liuData = {};
  clearQuery();
  updateNav();
  toggleSide(false);
  setView("library");
  $("#loadStatus").innerHTML = "";
  document.title = SITE_TITLE + " · 诗文藏书";
  renderLibrary();
  $("#reader").scrollTo(0, 0);
}
function renderLibrary() {
  const q = query.toLowerCase();
  const books = catalog.filter((b) =>
    [b.title, b.era, b.genre, b.byline, b.description]
      .join(" ")
      .toLowerCase()
      .includes(q),
  );
  let resume = "";
  const recent = prefs.get("classics:lastRead");
  try {
    const r = JSON.parse(recent);
    const meta = catalog.find((b) => b.id === r.bookId);
    if (meta && r.workId)
      resume = `<a class="resume-link" href="${readingRoute(meta.id, r.workId)}">接着读 · ${esc(meta.title)} · ${esc(r.title || "上次篇目")} →</a>`;
  } catch {}
  if (!resume) {
    const old = Number.parseInt(prefs.get(LS.chapter), 10);
    if (Number.isInteger(old) && old >= 0 && old < 36)
      resume = `<a class="resume-link" href="${readingRoute(LEGACY_BOOK, `chapter-${String(old + 1).padStart(2, "0")}`)}">接着读 · 世说新语 →</a>`;
  }
  $("#content").innerHTML =
    `<section class="library-page"><header class="library-intro"><h1>中国古典文学</h1><p class="library-lead">读一首唐诗，品一则世说。</p>${resume}</header><div class="shelf-heading"><h2>案头藏书</h2><span>${books.length} 部可读</span></div><div class="bookshelf">${books.map((b) => `<a class="book-card ${b.kind}" href="${bookRoute(b.id)}"><span class="book-cover" aria-hidden="true"><span class="cover-era">${esc(b.era)}</span><span class="cover-title">${esc(b.title)}</span><span class="cover-seal">${b.kind === "poetry" ? "诗" : "文"}</span></span><span class="book-info"><span class="eyebrow">${esc(b.genre)}</span><h3>${esc(b.title)}</h3><span class="book-byline">${esc(b.byline)}</span><span class="book-description">${esc(b.description)}</span><span class="book-count">${b.count} ${esc(b.unit)} <span>开卷阅读 →</span></span></span></a>`).join("") || '<p class="empty" role="status">未找到相关藏书，换个关键词试试。</p>'}</div></section>`;
}
function renderBookOverview() {
  setView(current >= 0 ? "search" : "book");
  updateNav();
  toggleSide(false);
  const meta = activeBook,
    poetry = meta.kind === "poetry";
  const matches = findWorks(book, query).filter(
    ({ work }) => !genreFilter || work.genre === genreFilter,
  );
  const shown = matches.slice(0, listLimit),
    genres = [...new Set(book.map((ch) => ch.genre).filter(Boolean))];
  const saved = prefs.get(storageKey(meta.id, "chapter")),
    resume = book.findIndex((ch) => ch.id === saved);
  const controls = poetry
    ? '<div id="genreFilters" class="genre-filters" role="group" aria-label="按诗体筛选"></div>'
    : "";
  $("#content").innerHTML =
    `<section class="collection-page"><header class="collection-header"><p class="eyebrow">${esc(meta.era)} · ${esc(meta.genre)}</p><h1>${esc(meta.title)}</h1><p class="collection-byline">${esc(meta.byline)}</p><p>${esc(meta.description)}</p><div class="collection-actions"><span id="startAction"></span></div></header>${controls}<div class="shelf-heading"><h2>${query ? "检索结果" : "篇目目录"}</h2><span role="status">${matches.length} ${esc(meta.sectionUnit || "篇")}</span></div><ol class="work-list">${shown.map(({ work, index }) => `<li><a class="work-link" href="${chapterURL(index)}"><span class="work-number">${String(index + 1).padStart(2, "0")}</span><span class="work-main"><span class="work-title">${esc(work.title)}</span>${work.author ? `<span class="work-author">${esc(work.author)} · ${esc(work.genre)}</span>` : ""}${query ? `<span class="work-preview">${esc(work.content[0])}</span>` : ""}</span><span aria-hidden="true">→</span></a></li>`).join("")}</ol>${!matches.length ? '<p class="empty" role="status">未找到相关篇目，换个题目、作者或诗句试试。</p>' : ""}<div id="moreAction"></div><details class="source-note"><summary>文本来源与整理说明</summary><p>${esc(meta.sourceNote)}</p><a href="${esc(meta.sourceUrl)}" target="_blank" rel="noopener noreferrer">查看原始来源 ↗</a>${meta.licensePath ? ` · <a href="./data/${esc(meta.licensePath)}">数据许可（MIT）</a>` : ""}</details></section>`;
  const startButton = document.createElement("button");
  startButton.type = "button";
  startButton.className = "primary-btn";
  startButton.id = "startBtn";
  startButton.textContent =
    resume >= 0
      ? "继续阅读 · " + book[resume].title
      : "开始阅读 · " + (meta.startLabel || book[0].title);
  startButton.onclick = () => navigate(resume >= 0 ? resume : 0);
  $("#startAction").append(startButton);
  if (matches.length > shown.length) {
    const moreButton = document.createElement("button");
    moreButton.type = "button";
    moreButton.className = "btn load-more";
    moreButton.id = "loadMore";
    moreButton.textContent = `再看 ${Math.min(40, matches.length - shown.length)} 篇`;
    moreButton.onclick = () => {
      const top = $("#reader").scrollTop;
      listLimit += 40;
      renderBookOverview();
      $("#reader").scrollTop = top;
      $("#loadMore")?.focus({ preventScroll: true });
    };
    $("#moreAction").append(moreButton);
  }
  if (poetry)
    for (const genre of ["", ...genres]) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "filter-btn";
      button.dataset.genre = genre;
      button.textContent = genre || "全部";
      button.setAttribute("aria-pressed", String(genreFilter === genre));
      button.onclick = () => {
        genreFilter = genre;
        listLimit = 40;
        renderBookOverview();
        $("#reader").scrollTo(0, 0);
        [...document.querySelectorAll("[data-genre]")]
          .find((b) => b.dataset.genre === genre)
          ?.focus({ preventScroll: true });
      };
      $("#genreFilters").append(button);
    }
}
function openChapter(i) {
  current = i;
  clearQuery();
  prefs.set(storageKey(activeBook.id, "chapter"), book[i].id);
  prefs.set(
    "classics:lastRead",
    JSON.stringify({
      bookId: activeBook.id,
      workId: book[i].id,
      title: book[i].title,
    }),
  );
  if (activeBook.id === LEGACY_BOOK) prefs.set(LS.chapter, i);
  renderChapter(positions[book[i].id]);
  updateNav();
  toggleSide(false);
  document.title =
    book[i].title + " · " + activeBook.title + " · " + SITE_TITLE;
}
function renderChapter(anchor) {
  if (current < 0 || !activeBook) return;
  setView("reading");
  const ch = book[current],
    q = query.toLowerCase(),
    showNotes = prefs.get(LS.notes) === "on",
    showTrans = prefs.get(LS.trans) === "on";
  const entries = ch.content
    .map((text, i) => {
      const raw = String(text);
      if (q && !raw.toLowerCase().includes(q)) return "";
      const key = ch.title + ":" + (i + 1),
        poemLine =
          activeBook.kind === "poetry" ? studyLine(notesData, ch, i) : null,
        notes =
          poemLine?.notes ||
          (Array.isArray(notesData[key]) ? notesData[key] : []),
        prose = proseEntry(translationsData, ch, i),
        trans =
          poemLine?.translation ||
          prose?.translation ||
          (!translationsData.schemaVersion ? translationsData[key] : null),
        liu = Array.isArray(liuData[key]) ? liuData[key] : [];
      const mentions =
        termsEnabled() && knowledgeData
          ? safeMentions(
              knowledgeData.mentions,
              activeBook.id,
              ch.id,
              i + 1,
              raw,
            )
          : [];
      const spans = mergedSpans(raw, showNotes ? notes : [], mentions);
      const highlight = (text) => {
        if (!q) return esc(text);
        let html = "",
          from = 0,
          at;
        while ((at = text.toLowerCase().indexOf(q, from)) >= 0) {
          html +=
            esc(text.slice(from, at)) +
            "<mark>" +
            esc(text.slice(at, at + q.length)) +
            "</mark>";
          from = at + q.length;
        }
        return html + esc(text.slice(from));
      };
      let html = "",
        from = 0;
      for (const span of spans) {
        const isTerm = span.mentions.length > 0;
        const types = [
          ...new Set(
            span.mentions.map(
              (m) =>
                knowledgeData.entities.entities.find((e) => e.id === m.entityId)
                  ?.type,
            ),
          ),
        ];
        const buttonId = isTerm
          ? "term-" + span.mentions[0].id
          : `note-trigger-${i}-${span.notes[0].index}`;
        const attrs = isTerm
          ? `data-mention-ids="${span.mentions.map((m) => m.id).join(" ")}" data-extra-notes="${esc(JSON.stringify(span.notes))}" aria-controls="${matchMedia("(max-width:820px)").matches ? "researchDialog" : "researchPanel"}" aria-label="${esc(raw.slice(span.start, span.end))}，${types.includes("place") ? "地名" : "器物"}研读"`
          : `aria-controls="note-${i}-${span.notes[0].index}"`;
        html +=
          highlight(raw.slice(from, span.start)) +
          `<button id="${buttonId}" class="annotated ${types.map((t) => "term-" + t).join(" ")}${span.mentions.some((m) => m.id === forcedMention) ? " term-target" : ""}" aria-expanded="false" ${attrs}>${highlight(raw.slice(span.start, span.end))}${!isTerm && span.notes.length ? "<sup>注</sup>" : ""}</button>`;
        from = span.end;
      }
      html += highlight(raw.slice(from));
      const noteHtml = spans
        .filter((span) => !span.mentions.length)
        .map(
          (span) =>
            `<div id="note-${i}-${span.notes[0].index}" class="note-pop" hidden>${span.notes.map((n) => `<b>${esc(n.word)}</b>　${esc(n.note)}`).join("<br>")}</div>`,
        )
        .join("");
      return `<section class="entry-wrap" data-entry="${i + 1}"><p class="entry${activeBook.kind === "poetry" ? " poem-line" : ""}">${html}</p>${noteHtml}${showNotes && liu.length ? `<details class="liu-note"><summary>刘孝标注（${liu.length}段）</summary>${liu.map((n) => `<p>${esc(n)}</p>`).join("")}</details>` : ""}${showTrans && trans ? `<p class="translation"><span class="tag">译</span>${esc(trans)}</p>${prose?.remarks ? `<details class="study-sources"><summary>本则译文疑义</summary><p>${esc(prose.remarks)}</p></details>` : ""}` : ""}</section>`;
    })
    .filter(Boolean)
    .join("");
  const poetry = activeBook.kind === "poetry";
  const heading = poetry
    ? `<h1 class="chapter-title poem-title">${esc(ch.title)}</h1><div class="meta poem-author">唐 · ${esc(ch.author)}<span>${esc(ch.genre)}</span></div><div class="rule"></div>`
    : `<h1 class="book-title">${esc(activeBook.title)}</h1><div class="meta">${esc(activeBook.byline)}</div><div class="rule"></div><h2 class="chapter-title">${esc(ch.title)} · 第${current + 1}${esc(activeBook.sectionUnit || "篇")}</h2>`;
  const study = poetry ? notesData.poems?.[ch.id] : null;
  const proseInfo =
    !poetry && showTrans && translationsData.editorialNote
      ? `<details class="study-sources"><summary>译文说明与参考资料</summary><p>${esc(translationsData.editorialNote)}</p><ul>${(proseEntry(translationsData, ch, 0)?.sources || []).map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a></li>`).join("")}</ul></details>`
      : "";
  const studyInfo =
    study && (showNotes || showTrans)
      ? `<details class="study-sources"><summary>注译说明与参考资料</summary><p>${esc(study.editorialNote)}</p>${study.remarks ? `<p>${esc(study.remarks)}</p>` : ""}<ul>${study.sources.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a></li>`).join("")}</ul></details>`
      : "";
  const context = poetry ? contextEntry(contextData, ch) : null;
  const contextInfo = context
    ? `<details class="poem-context"${openContexts.has(ch.id) ? " open" : ""}><summary>创作背景与诗中情绪</summary><h3>创作背景</h3><p>${esc(context.background)}</p><h3>诗中情绪 · 解读</h3><p>${esc(context.mood)}</p><p>原句依据：<q>${esc(context.evidence)}</q></p>${context.remarks ? `<p>${esc(context.remarks)}</p>` : ""}<details class="context-sources"${openContextSources.has(ch.id) ? " open" : ""}><summary>整理说明与资料</summary><p>${esc(contextData.editorialNote)}</p><ul>${context.sources.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a></li>`).join("")}</ul></details></details>`
    : "";
  const pagination = `<nav class="reading-pagination" aria-label="篇目翻页">${current > 0 ? `<a href="${chapterURL(current - 1)}">← 上一${poetry ? "首" : "篇"}</a>` : "<span>已是首篇</span>"}<a href="${bookRoute(activeBook.id)}">返回目录</a>${current < book.length - 1 ? `<a href="${chapterURL(current + 1)}">下一${poetry ? "首" : "篇"} →</a>` : "<span>已是末篇</span>"}</nav>`;
  $("#content").innerHTML =
    `<article class="paper${poetry ? " poem-paper" : ""}">${heading}${entries || `<div class="empty" role="status">当前篇未找到“${esc(query)}”</div>`}${contextInfo}${studyInfo}${proseInfo}${pagination}</article>`;
  const contextSources = $(".context-sources");
  if (contextSources)
    contextSources.ontoggle = () => {
      if (contextSources.open) openContextSources.add(ch.id);
      else openContextSources.delete(ch.id);
    };
  const contextPanel = $(".poem-context");
  if (contextPanel)
    contextPanel.ontoggle = () => {
      if (contextPanel.open) openContexts.add(ch.id);
      else openContexts.delete(ch.id);
      updateProgress();
    };
  restore(anchor);
  $("#knowledgeBtn").setAttribute("aria-pressed", String(termsEnabled()));
  followMention();
  if (termsEnabled() && !knowledgeData && !knowledgeLoading && !knowledgeError)
    void prepareKnowledge();
}
function capture() {
  if (current < 0 || view !== "reading") return null;
  const r = $("#reader"),
    bounds = r.getBoundingClientRect(),
    v = vertical(),
    ref = v ? bounds.right - 20 : bounds.top + 20;
  const contextPanel = $(".poem-context");
  if (contextPanel) {
    const b = contextPanel.getBoundingClientRect();
    const lastEntry = document.querySelector("[data-entry]:last-of-type");
    const lastBounds = lastEntry?.getBoundingClientRect();
    const afterText =
      lastBounds && (v ? lastBounds.left >= ref : lastBounds.bottom <= ref);
    if (
      v
        ? b.left < ref + 1 && b.right > bounds.left
        : (b.top <= ref + 1 || (afterText && b.top < bounds.bottom)) &&
          b.bottom > ref
    )
      return {
        entry: book[current].content.length,
        offset: 1,
        section: "context",
        sectionOffset: Math.max(
          -1,
          Math.min(
            1,
            v
              ? (b.right - ref) / Math.max(1, b.width)
              : (ref - b.top) / Math.max(1, b.height),
          ),
        ),
        panelScroll: contextPanel.scrollTop,
      };
  }
  const entries = [...document.querySelectorAll("[data-entry]")];
  const entry =
    entries.find((el) => {
      const b = el.getBoundingClientRect();
      return v
        ? b.left < ref && b.right > bounds.left
        : b.bottom > ref && b.top < bounds.bottom;
    }) || entries[0];
  if (!entry) return null;
  const b = entry.getBoundingClientRect();
  return {
    atStart: (v ? Math.abs(r.scrollLeft) : r.scrollTop) < 1,
    entry: Number(entry.dataset.entry),
    offset: Math.max(
      0,
      Math.min(
        1,
        v
          ? (b.right - ref) / Math.max(1, b.width)
          : (ref - b.top) / Math.max(1, b.height),
      ),
    ),
  };
}
function savePosition() {
  if (current < 0 || view !== "reading" || query || restoring || !activeBook)
    return;
  const anchor = capture();
  if (anchor) {
    positions[book[current].id] = anchor;
    prefs.set(
      storageKey(activeBook.id, "positions"),
      JSON.stringify(positions),
    );
  }
}
function restore(anchor) {
  restoring = true;
  clearTimeout(saveTimer);
  const r = $("#reader");
  r.scrollTo({ top: 0, left: 0, behavior: "instant" });
  if (
    anchor &&
    !anchor.atStart &&
    Number.isInteger(anchor.entry) &&
    Number.isFinite(anchor.offset)
  ) {
    const panel = anchor.section === "context" ? $(".poem-context") : null;
    const el =
      panel || document.querySelector(`[data-entry="${anchor.entry}"]`);
    if (el) {
      const b = el.getBoundingClientRect(),
        bounds = r.getBoundingClientRect(),
        offset = Math.max(
          panel ? -1 : 0,
          Math.min(1, panel ? anchor.sectionOffset : anchor.offset),
        );
      if (panel) panel.scrollTop = Number(anchor.panelScroll) || 0;
      r.scrollBy({
        top: vertical() ? 0 : b.top - bounds.top - 20 + offset * b.height,
        left: vertical() ? b.right - (bounds.right - 20) - offset * b.width : 0,
        behavior: "instant",
      });
    }
  }
  updateProgress();
  requestAnimationFrame(() => {
    restoring = false;
  });
}
function updateProgress() {
  const r = $("#reader"),
    max = vertical()
      ? r.scrollWidth - r.clientWidth
      : r.scrollHeight - r.clientHeight,
    position = vertical() ? Math.abs(r.scrollLeft) : r.scrollTop,
    ratio =
      current < 0 || view !== "reading"
        ? 0
        : max > 0
          ? Math.max(0, Math.min(1, position / max))
          : 0;
  $("#progress").style.width = ratio * 100 + "%";
  $("#progress").style.left = vertical() ? "auto" : "0";
  $("#progress").style.right = vertical() ? "0" : "auto";
  $("#progress").setAttribute("aria-valuenow", String(Math.round(ratio * 100)));
  $("#topBtn").classList.toggle("show", view === "reading" && position > 500);
}
function toggleSide(on) {
  on = on && view === "reading";
  $("#side").classList.toggle("open", on);
  $("#scrim").classList.toggle("show", on);
  $("#menuBtn").setAttribute("aria-expanded", String(on));
  const mobile = matchMedia("(max-width:820px)").matches;
  $("#side").inert = view !== "reading" || (mobile && !on);
}
init();
