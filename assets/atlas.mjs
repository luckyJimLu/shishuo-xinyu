import {
  atlasPlaces,
  markerGroups,
  atlasRoute,
  mentionRoute,
  PERIODS,
  loadKnowledge,
} from "./knowledge.mjs";
import { entityDetails } from "./research-panel.mjs";
const make = (tag, text, className) => {
  const el = document.createElement(tag);
  if (text != null) el.textContent = text;
  if (className) el.className = className;
  return el;
};
let leafletPromise;
async function leaflet() {
  if (!leafletPromise) {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "./assets/vendor/leaflet/leaflet.css";
    document.head.append(css);
    leafletPromise = import("./vendor/leaflet/leaflet-src.esm.js").catch(
      (e) => {
        leafletPromise = null;
        throw e;
      },
    );
  }
  return leafletPromise;
}
export async function mountAtlas(
  root,
  { catalog, filters = {}, context = {}, onURLChange, isCurrent = () => true },
) {
  const state = {
    book: "",
    period: "",
    q: "",
    place: "",
    scope: "all",
    ...filters,
  };
  if (!catalog.some((b) => b.id === state.book)) state.book = "";
  if (!PERIODS.includes(state.period)) state.period = "";
  if (state.contextBook && state.work)
    context = { contextBook: state.contextBook, work: state.work };
  if (!context.work || !catalog.some((b) => b.id === context.contextBook))
    state.scope = "all";
  if (!["all", "current"].includes(state.scope)) state.scope = "all";
  let cancelled = false,
    map = null,
    L = null,
    markers = null,
    geoLayers = [],
    data = null,
    themeObserver = null;
  root.replaceChildren();
  const page = make("section", null, "atlas-page");
  root.append(page);
  const back = make("a", "← 藏书首页", "back-link");
  back.href = "#/";
  const head = make("header", null, "atlas-heading");
  head.append(
    make("p", "循文访地 · 以地读文", "eyebrow"),
    make("h1", "文学地名地图"),
    make(
      "p",
      "现代山川底图与历史地名参考位置；不表示某朝代疆界。",
      "atlas-description",
    ),
  );
  const controls = make("div", null, "atlas-filters");
  function select(label, id, options, value, change) {
    const wrap = make("label", label);
    const input = make("select");
    input.id = id;
    for (const [v, t] of options) {
      const o = make("option", t);
      o.value = v;
      input.append(o);
    }
    input.value = value;
    input.onchange = () => change(input.value);
    wrap.append(input);
    controls.append(wrap);
    return input;
  }
  select(
    "书目",
    "atlasBook",
    [["", "全部书目"], ...catalog.map((b) => [b.id, b.title])],
    state.book,
    (value) => {
      state.book = value;
      state.place = "";
      update();
    },
  );
  select(
    "语境时期",
    "atlasPeriod",
    [["", "全部时期"], ...PERIODS.map((p) => [p, p])],
    state.period,
    (value) => {
      state.period = value;
      state.place = "";
      update();
    },
  );
  const scopes = make("div", null, "atlas-scopes");
  scopes.setAttribute("role", "group");
  scopes.setAttribute("aria-label", "地名范围");
  const scopeButtons = [];
  for (const [value, text] of [
    ["all", "全部地名"],
    ["current", "当前篇目地名"],
  ]) {
    const b = make("button", text, "filter-btn");
    b.type = "button";
    b.dataset.scope = value;
    b.disabled = value === "current" && !context.work;
    b.title = b.disabled ? "先打开一篇作品，再从正文进入地图" : "";
    b.onclick = () => {
      state.scope = value;
      state.place = "";
      update();
    };
    scopes.append(b);
    scopeButtons.push(b);
  }
  controls.append(scopes);
  const switcher = make("div", null, "atlas-switcher");
  switcher.setAttribute("role", "group");
  switcher.setAttribute("aria-label", "切换地图与地名列表");
  for (const mode of ["map", "list"]) {
    const b = make(
      "button",
      mode === "map" ? "地图" : "地名列表",
      "filter-btn",
    );
    b.type = "button";
    b.setAttribute("aria-pressed", String(mode === "map"));
    b.onclick = () => {
      page.dataset.mobileView = mode;
      switcher
        .querySelectorAll("button")
        .forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      requestAnimationFrame(() => map?.invalidateSize());
    };
    switcher.append(b);
  }
  page.dataset.mobileView = "map";
  const live = make("p", "正在整理地名…", "atlas-count");
  live.setAttribute("role", "status");
  const layout = make("div", null, "atlas-layout"),
    mapColumn = make("div", null, "atlas-map-column"),
    canvas = make("div", null, "atlas-canvas"),
    mapStatus = make("div", "正在铺开山川底图…", "atlas-map-status");
  canvas.id = "literaryMap";
  canvas.setAttribute(
    "aria-label",
    "文学地名地图，可用方向键平移，使用加减按钮缩放",
  );
  canvas.tabIndex = 0;
  const reset = make("button", "重置视野", "btn");
  reset.type = "button";
  reset.onclick = () =>
    map?.fitBounds(
      [
        [17, 73],
        [53, 136],
      ],
      { animate: false },
    );
  const legend = make(
    "p",
    "○ 区域示意　·　定位待考的地名仅列于列表　·　出现次数仅计已复核词例",
    "atlas-legend",
  );
  const credits = make("p", null, "atlas-credits");
  const creditLink = make("a", "Natural Earth · 公有领域");
  creditLink.href = "./data/maps/LICENSE-Natural-Earth.md";
  const leafletLicense = make("a", "Leaflet · BSD-2-Clause");
  leafletLicense.href = "./assets/vendor/leaflet/LICENSE";
  credits.append(creditLink, " / ", leafletLicense);
  mapColumn.append(canvas, mapStatus, reset, legend, credits);
  const side = make("aside", null, "atlas-sidebar"),
    list = make("div", null, "atlas-place-list"),
    details = make("div", null, "atlas-details");
  side.setAttribute("aria-label", "地名列表和相关诗文");
  side.append(list, details);
  layout.append(mapColumn, side);
  const mapFailure = make("div", null, "atlas-failure");
  mapFailure.hidden = true;
  mapFailure.setAttribute("role", "status");
  page.append(back, head, controls, switcher, live, mapFailure, layout);
  const dispose = () => {
    cancelled = true;
    themeObserver?.disconnect();
    map?.remove();
    map = null;
  };
  function syncURL() {
    const url = atlasRoute({ ...state, ...context });
    history.replaceState(null, "", url);
    onURLChange?.();
  }
  function colors() {
    const s = getComputedStyle(document.documentElement);
    return {
      land: s.getPropertyValue("--paper2").trim(),
      line: s.getPropertyValue("--line").trim(),
      point: s.getPropertyValue("--accent").trim(),
      water: s.getPropertyValue("--map-water").trim(),
    };
  }
  function refreshTheme() {
    const c = colors();
    for (const [layer, type] of geoLayers)
      layer.setStyle(
        type === "land"
          ? { color: c.line, fillColor: c.land }
          : { color: c.water },
      );
    markers?.eachLayer((m) =>
      m.setStyle({ color: c.point, fillColor: c.land }),
    );
  }
  async function initMap() {
    themeObserver?.disconnect();
    map?.remove();
    map = null;
    markers = null;
    geoLayers = [];
    mapFailure.hidden = true;
    mapStatus.hidden = false;
    mapStatus.textContent = "正在铺开山川底图…";
    try {
      const [lib, land, rivers] = await Promise.all([
        leaflet(),
        ...["land", "rivers"].map(async (name) => {
          const r = await fetch("./data/maps/" + name + ".geojson", {
            signal: AbortSignal.timeout(15000),
          });
          if (!r.ok) throw Error("地图数据 HTTP " + r.status);
          return r.json();
        }),
      ]);
      if (cancelled || !isCurrent()) return;
      L = lib;
      map = L.map(canvas, {
        attributionControl: false,
        zoomControl: false,
        minZoom: 3,
        maxZoom: 8,
        keyboard: true,
      }).fitBounds([
        [17, 73],
        [53, 136],
      ]);
      L.control
        .zoom({ zoomInTitle: "放大地图", zoomOutTitle: "缩小地图" })
        .addTo(map);
      const c = colors();
      geoLayers = [
        [
          L.geoJSON(land, {
            interactive: false,
            style: {
              color: c.line,
              weight: 1,
              fillColor: c.land,
              fillOpacity: 1,
            },
          }).addTo(map),
          "land",
        ],
        [
          L.geoJSON(rivers, {
            interactive: false,
            style: { color: c.water, weight: 1.1, opacity: 0.8 },
          }).addTo(map),
          "water",
        ],
      ];
      markers = L.layerGroup().addTo(map);
      mapStatus.hidden = true;
      themeObserver = new MutationObserver(refreshTheme);
      themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
      });
      updateMarkers();
    } catch {
      if (cancelled) return;
      mapStatus.hidden = true;
      mapFailure.hidden = false;
      mapFailure.replaceChildren(
        make("p", "底图暂不可用，仍可查阅地名列表和相关诗文。"),
      );
      const retry = make("button", "重试地图", "btn");
      retry.type = "button";
      retry.onclick = () => {
        page.dataset.mobileView = "map";
        switcher
          .querySelectorAll("button")
          .forEach((b, i) => b.setAttribute("aria-pressed", String(i === 0)));
        void initMap();
      };
      mapFailure.append(retry);
      page.dataset.mobileView = "list";
      switcher
        .querySelectorAll("button")
        .forEach((b, i) => b.setAttribute("aria-pressed", String(i === 1)));
    }
  }
  function selectPlace(id) {
    state.place = id;
    updateDetails();
    syncURL();
    list
      .querySelectorAll("button")
      .forEach((b) =>
        b.setAttribute("aria-pressed", String(b.dataset.place === id)),
      );
  }
  function updateDetails() {
    if (!data) return;
    const places = atlasPlaces(data.entities, data.mentions, {
      ...state,
      ...context,
    });
    const selected = places.find((p) => p.entity.id === state.place);
    details.replaceChildren();
    if (!selected) {
      details.append(
        make("p", "选择一个地名，查看古今对应与相关诗文。", "atlas-empty"),
      );
      return;
    }
    details.append(entityDetails(selected.entity, [], { atlasLink: false }));
    details.append(
      make("h3", "相关诗文 · " + selected.mentions.length + " 处"),
    );
    const citations = make("ol", null, "atlas-citations");
    for (const m of selected.mentions) {
      const li = make("li"),
        a = make("a", m.bookTitle + " · " + m.title);
      a.href = mentionRoute(m);
      li.append(
        a,
        make("p", m.text),
        make("small", m.period + " · " + m.context),
      );
      citations.append(li);
    }
    details.append(citations);
  }
  function updateMarkers() {
    if (!data || !markers) return;
    markers.clearLayers();
    const places = atlasPlaces(data.entities, data.mentions, {
      ...state,
      ...context,
    });
    const c = colors();
    for (const group of markerGroups(places)) {
      const names = group.places.map((p) => p.entity.name);
      const label =
        names.join("／") + " · " + group.mentions.length + " 处词例";
      const marker = L.circleMarker(
        [group.coordinates[1], group.coordinates[0]],
        {
          radius: 6 + Math.min(4, group.places.length - 1),
          color: c.point,
          weight: 2,
          fillColor: c.land,
          fillOpacity: 1,
        },
      ).addTo(markers);
      const tooltip = make("span", label);
      marker.bindTooltip(tooltip, { direction: "top" });
      const choose = () => {
        if (matchMedia("(max-width:820px)").matches) {
          page.dataset.mobileView = "list";
          switcher
            .querySelectorAll("button")
            .forEach((b, i) => b.setAttribute("aria-pressed", String(i === 1)));
        }
        selectPlace(group.places[0].entity.id);
        if (group.places.length > 1) {
          const choices = make("div", null, "atlas-point-choices");
          choices.append(make("p", "同一参考位置的名称"));
          for (const p of group.places) {
            const b = make("button", p.entity.name, "filter-btn");
            b.type = "button";
            b.onclick = () => selectPlace(p.entity.id);
            choices.append(b);
          }
          details.prepend(choices);
        }
        details.scrollIntoView({ block: "nearest", behavior: "instant" });
      };
      marker.on("click", choose);
      const element = marker.getElement();
      element?.setAttribute("tabindex", "0");
      element?.setAttribute("role", "button");
      element?.setAttribute("aria-label", label + "，区域示意");
      element?.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          choose();
        }
      });
    }
  }
  function update() {
    if (cancelled || !isCurrent() || !data) return;
    const places = atlasPlaces(data.entities, data.mentions, {
      ...state,
      ...context,
    });
    const count = places.reduce((s, p) => s + p.mentions.length, 0);
    live.textContent = places.length + " 个地名 · " + count + " 处已复核词例";
    scopeButtons.forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.scope === state.scope)),
    );
    list.replaceChildren(make("h2", "地名索引"));
    for (const p of places) {
      const b = make("button", null, "atlas-place");
      b.type = "button";
      b.dataset.place = p.entity.id;
      b.setAttribute("aria-pressed", String(state.place === p.entity.id));
      b.append(
        make("strong", p.entity.name),
        make(
          "span",
          p.mentions.length +
            " 处 · " +
            (p.entity.locations.length ? "区域示意" : "定位待考"),
        ),
      );
      b.onclick = () => selectPlace(p.entity.id);
      list.append(b);
    }
    if (!places.length)
      list.append(
        make(
          "p",
          "未找到符合筛选的地名。可清除检索或切换书目、时期。",
          "atlas-empty",
        ),
      );
    updateDetails();
    updateMarkers();
    syncURL();
  }
  try {
    data = await loadKnowledge();
    if (!cancelled && isCurrent()) {
      update();
      void initMap();
    }
  } catch {
    if (!cancelled) {
      live.textContent = "名物资料加载失败，正文阅读仍可使用。";
      const retry = make("button", "重试名物资料", "btn");
      retry.type = "button";
      retry.onclick = () => location.reload();
      live.append(retry);
      mapStatus.hidden = true;
    }
  }
  return {
    destroy: dispose,
    search(q) {
      state.q = q;
      state.place = "";
      update();
    },
  };
}
