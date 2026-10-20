"use strict";
const $ = (s) => document.querySelector(s);
const LS = {
  theme: "ssxy_theme",
  fs: "ssxy_fs",
  dir: "ssxy_dir",
  notes: "ssxy_notes",
  trans: "ssxy_trans",
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
  liuData = {},
  positions = {},
  restoring = false,
  searchAnchor = null,
  saveTimer;
const optional = [
  {
    path: "annotations.json",
    label: "词义注",
    apply: (data) => {
      notesData = data;
    },
  },
  {
    path: "translations.json",
    label: "译文",
    apply: (data) => {
      translationsData = data;
    },
  },
  {
    path: "liuxiaobiao-notes.json",
    label: "刘孝标注",
    apply: (data) => {
      liuData = data.notes;
    },
  },
];
const failed = new Set();
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
  if ($("#retryOptional"))
    $("#retryOptional").onclick = () => loadOptional([...failed]);
}
async function loadOptional(items = optional) {
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
          item.path.startsWith("liuxiaobiao") &&
          (!data.notes || typeof data.notes !== "object")
        )
          throw Error("缺少注文");
        item.apply(data);
        failed.delete(item);
      } catch {
        failed.add(item);
      }
    }),
  );
  const anchor = capture();
  status();
  if (current >= 0) renderChapter(anchor);
}
async function init() {
  restorePrefs();
  bind();
  try {
    const saved = JSON.parse(prefs.get(LS.pos) || "{}");
    if (saved && typeof saved === "object" && !Array.isArray(saved))
      positions = saved;
  } catch {
    positions = {};
  }
  try {
    const data = await json("shishuo-xinyu.json");
    book = Array.isArray(data) ? data : data.articles || [];
    if (
      !book.length ||
      !book.every(
        (ch) => typeof ch.title === "string" && Array.isArray(ch.content),
      )
    )
      throw Error("未识别正文数据结构");
    renderNav();
    $("#total").textContent = book.length + " 篇";
    const saved = Number.parseInt(prefs.get(LS.chapter), 10);
    if (location.hash) route();
    else if (saved >= 0 && saved < book.length) {
      history.replaceState(null, "", chapterURL(saved));
      openChapter(saved);
    } else showHome();
    void loadOptional();
  } catch (e) {
    $("#content").innerHTML =
      `<div class="empty">正文加载失败：${esc(e.message)}<br><button id="retryBook" class="btn">重新加载</button></div>`;
    $("#retryBook").onclick = () => location.reload();
  }
}
function chapterURL(i) {
  return "#/chapter/" + encodeURIComponent(book[i].title);
}
function route() {
  savePosition();
  let title = "";
  try {
    title = decodeURIComponent(location.hash.replace(/^#\/chapter\//, ""));
  } catch {}
  if (!location.hash) {
    showHome();
    return;
  }
  const i = book.findIndex((ch) => ch.title === title);
  if (i >= 0) openChapter(i);
  else {
    current = -1;
    updateNav();
    document.title = "篇目未找到 · 世说新语";
    $("#content").innerHTML =
      '<div class="empty">未找到此篇，请从目录选择篇目。</div>';
    updateProgress();
  }
}
function navigate(i) {
  savePosition();
  const url = i < 0 ? location.pathname + location.search : chapterURL(i);
  history.pushState(null, "", url);
  if (i < 0) showHome();
  else openChapter(i);
}
function bind() {
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
      renderChapter(anchor);
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
  const search = () => {
    if (!query) searchAnchor = capture();
    query = $("#search").value.trim();
    $("#clearSearch").hidden = !query;
    if (current >= 0) renderChapter(query ? null : searchAnchor);
  };
  $("#search").addEventListener("input", (e) => {
    if (!e.isComposing) search();
  });
  $("#search").addEventListener("compositionend", search);
  $("#clearSearch").onclick = () => {
    $("#search").value = "";
    search();
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
    const a = e.target.closest(".annotated");
    if (a) {
      const p = document.getElementById(a.getAttribute("aria-controls"));
      p.hidden = !p.hidden;
      a.setAttribute("aria-expanded", String(!p.hidden));
    }
  });
  window.addEventListener("popstate", route);
  window.addEventListener("hashchange", () => {
    const hash = current >= 0 ? chapterURL(current) : "";
    if (location.hash !== hash) route();
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
    if (current >= 0 && anchor) restore(anchor);
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
  if (current >= 0) restore(anchor);
}
function renderNav() {
  $("#chapters").innerHTML = book
    .map(
      (ch, i) =>
        `<button class="chapter" data-chapter="${i}"><span class="num">${String(i + 1).padStart(2, "0")}</span><span>${esc(ch.title)}</span><span class="count">${ch.content.length}</span></button>`,
    )
    .join("");
  $("#chapters").onclick = (e) => {
    const button = e.target.closest("[data-chapter]");
    if (button) navigate(Number(button.dataset.chapter));
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
  clearQuery();
  updateNav();
  toggleSide(false);
  document.title = "世说新语 · 古籍阅读";
  $("#content").innerHTML =
    '<section class="welcome"><div class="big-seal">世说</div><h1>世说新语</h1><p>刘宋 · 刘义庆 撰　梁 · 刘孝标 注</p><p>原文为阅读主层；注释与现代汉语译文按需开启，译文默认隐藏。</p><button id="startBtn">开始阅读 · 德行第一</button></section>';
  $("#startBtn").onclick = () => navigate(0);
  $("#reader").scrollTo(0, 0);
  updateProgress();
}
function openChapter(i) {
  current = i;
  clearQuery();
  prefs.set(LS.chapter, i);
  renderChapter(positions[book[i].title]);
  updateNav();
  toggleSide(false);
  document.title = book[i].title + " · 世说新语";
}
function renderChapter(anchor) {
  if (current < 0) return;
  const ch = book[current],
    q = query.toLowerCase(),
    showNotes = prefs.get(LS.notes) === "on",
    showTrans = prefs.get(LS.trans) === "on";
  const entries = ch.content
    .map((text, i) => {
      const raw = String(text);
      if (q && !raw.toLowerCase().includes(q)) return "";
      const key = ch.title + ":" + (i + 1),
        notes = Array.isArray(notesData[key]) ? notesData[key] : [],
        trans = translationsData[key],
        liu = Array.isArray(liuData[key]) ? liuData[key] : [];
      // Build markup from raw-text intervals so annotation words can never replace generated HTML.
      const spans = [];
      if (showNotes)
        notes.forEach((n, j) => {
          const at = raw.indexOf(n.word);
          if (
            n.word &&
            at >= 0 &&
            !spans.some((s) => at < s.end && at + n.word.length > s.start)
          )
            spans.push({ start: at, end: at + n.word.length, n, j });
        });
      spans.sort((a, b) => a.start - b.start);
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
      for (const s of spans) {
        html +=
          highlight(raw.slice(from, s.start)) +
          `<button class="annotated" aria-expanded="false" aria-controls="note-${i}-${s.j}">${highlight(raw.slice(s.start, s.end))}<sup>注</sup></button>`;
        from = s.end;
      }
      html += highlight(raw.slice(from));
      const noteHtml = spans
        .map(
          (s) =>
            `<div id="note-${i}-${s.j}" class="note-pop" hidden><b>${esc(s.n.word)}</b>　${esc(s.n.note)}</div>`,
        )
        .join("");
      return `<section class="entry-wrap" data-entry="${i + 1}"><p class="entry">${html}</p>${noteHtml}${showNotes && liu.length ? `<details class="liu-note"><summary>刘孝标注（${liu.length}段）</summary>${liu.map((n) => `<p>${esc(n)}</p>`).join("")}</details>` : ""}${showTrans && trans ? `<p class="translation"><span class="tag">译</span>${esc(trans)}</p>` : ""}</section>`;
    })
    .filter(Boolean)
    .join("");
  $("#content").innerHTML =
    `<article class="paper"><h1 class="book-title">世说新语</h1><div class="meta">刘宋 · 刘义庆 撰　梁 · 刘孝标 注</div><div class="rule"></div><h2 class="chapter-title">${esc(ch.title)} · 第${current + 1}门</h2>${entries || `<div class="empty" role="status">当前篇未找到“${esc(query)}”</div>`}</article>`;
  restore(anchor);
}
function capture() {
  if (current < 0) return null;
  const r = $("#reader"),
    bounds = r.getBoundingClientRect(),
    v = vertical(),
    ref = v ? bounds.right - 20 : bounds.top + 20;
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
  if (current < 0 || query || restoring) return;
  const anchor = capture();
  if (anchor) {
    positions[book[current].title] = anchor;
    prefs.set(LS.pos, JSON.stringify(positions));
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
    const el = document.querySelector(`[data-entry="${anchor.entry}"]`);
    if (el) {
      const b = el.getBoundingClientRect(),
        bounds = r.getBoundingClientRect(),
        offset = Math.max(0, Math.min(1, anchor.offset));
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
      current < 0 ? 0 : max > 0 ? Math.max(0, Math.min(1, position / max)) : 0;
  $("#progress").style.width = ratio * 100 + "%";
  $("#progress").style.left = vertical() ? "auto" : "0";
  $("#progress").style.right = vertical() ? "0" : "auto";
  $("#progress").setAttribute("aria-valuenow", String(Math.round(ratio * 100)));
  $("#topBtn").classList.toggle("show", position > 500);
}
function toggleSide(on) {
  $("#side").classList.toggle("open", on);
  $("#scrim").classList.toggle("show", on);
  $("#menuBtn").setAttribute("aria-expanded", String(on));
  const mobile = matchMedia("(max-width:820px)").matches;
  $("#side").inert = mobile && !on;
}
init();
