// running.js: the analytics a set-up project shows above its activity: one
// big card with a 14-day graph, and the kind's other numbers as small
// tiles under it. Press a small tile and it takes the big spot, the two
// morphing between places; the numbers follow the store while you watch.
import { icon } from "../icons.js";
import { kindOf } from "../kinds.js";
import { project, subscribe } from "../store.js";
import { formatMoney, formatNum, numberIn, odometerTo, reduceMotion, seeded, shortDate } from "../util.js";

const W = 720;
// shallower than the gallery's chart: the rail holds this beside two
// other cards and has to fit a laptop window without scrolling
const H = 170;
const PAD_L = 48;
const PAD_R = 8;
const PAD_T = 12;
const PAD_B = 24;

// the last 14 days end today, so the axis reads as a calendar
export const dayLabels = (n = 14) => Array.from({ length: n }, (_, i) => shortDate(Date.now() - (n - 1 - i) * 86400000));

// ---------- metrics: the series and every tile, one shape ----------

const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

// a tile's own 14 days, shaped from its current value: a seeded ramp that
// ends exactly on today's number, so the graph and the tile agree
function tileSeries(p, t, value) {
  const rnd = seeded(hash(`${p.id}:${t.id}`));
  const slope = 0.55 + rnd() * 0.35;
  const noise = Array.from({ length: 14 }, () => 0.94 + rnd() * 0.12);
  return noise.map((n, i) => {
    const share = slope + (1 - slope) * (i / 13);
    const v = i === 13 ? value : value * share * n;
    return t.format === "pct" ? Math.round(v * 10) / 10 : Math.round(v);
  });
}

const formats = {
  money: { value: formatMoney, axis: (v) => (v >= 1000 ? `$${Math.round(v / 100) / 10}k` : `$${Math.round(v)}`) },
  num: { value: formatNum, axis: (v) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(Math.round(v))) },
  pct: { value: (n) => `${Number(n).toFixed(1)}%`, axis: (v) => `${Math.round(v)}%` },
};

const pct30 = (p, i) => (p.history[i] ? Math.round(((p.users[i] - p.history[i]) / p.history[i]) * 1000) / 10 : 0);
const tileValue = (p, t) => (t.id === "revenue" ? p.revenue : t.id === "adSpend" ? p.adSpend : (p.stats?.[t.id] ?? 0));

// a live-backed project has no simulated series: its metrics are the
// counters the loop keeps for real, and its graph is the actions the
// agents actually took, day by day
// predicted kpis first: the card shows THIS goal's outcomes (Comments posted),
// tallied server-side into counters.kpi; the generic counters are the fallback
// for a project whose prediction has not landed yet
function kpiTiles(p) {
  const bag = (p.counters && p.counters.kpi) || {};
  const list = (p.kpis && p.kpis.list) || [];
  // the ONE kpi the server keeps a daily series for (the first one backed by a
  // connector metric). It is drawn from its own 14 days and 30 before, and its
  // pill is the change over that window; the others are single numbers.
  const primary = list.find((k) => k.source && k.source.kind === "metric" && Array.isArray(p.users) && p.users.length);
  return list.slice(0, 3).map((k) => {
    const series = primary && k.id === primary.id;
    return {
      id: k.id,
      label: k.label,
      format: formats[k.format] ? k.format : "num",
      values: series ? p.users : [bag[k.id] || 0],
      delta: series ? pct30(p, p.users.length - 1) : null,
      deltaLabel: series ? "over the past 30 days" : undefined,
    };
  });
}

function liveMetrics(p) {
  const predicted = kpiTiles(p);
  if (predicted.length) return predicted;
  // no prediction yet, but the connectors are already reporting: show THEIR
  // numbers, under the labels the server sent with them. This is the rail a
  // goal has between connecting its first account and agreeing its plan.
  const declared = Object.values(p.metricTiles || {}).filter((t) => Number.isFinite(Number(p.stats?.[t.id])));
  if (declared.length) {
    return declared.slice(0, 4).map((t) => ({ id: t.id, label: t.label, format: formats[t.format] ? t.format : "num", values: [Number(p.stats[t.id])], delta: null }));
  }
  const days = 14;
  const now = Date.now();
  const buckets = Array.from({ length: days }, () => 0);
  for (const it of [...(p.thread || []), ...(p.activity || [])]) {
    const at = it?.at;
    if (!at) continue;
    const d = days - 1 - Math.min(days - 1, Math.floor((now - at) / 86400000));
    if (d >= 0) buckets[d]++;
  }
  const counters = p.counters || {};
  const missionsDone = (p.missions || []).filter((m) => m.status === "complete").length;
  const tiles = [
    { id: "missions", label: "Missions completed", format: "num", values: [missionsDone], delta: null },
    { id: "tools", label: "Tool calls", format: "num", values: [counters.tools || 0], delta: null },
    { id: "videos", label: "Videos uploaded", format: "num", values: [counters.videos || 0], delta: null },
  ];
  const series = { id: "series", label: "Agent actions, last 14 days", format: "num", values: buckets, delta: buckets[0] ? ((buckets.at(-1) - buckets[0]) / buckets[0]) * 100 : 0, deltaLabel: "today against the first day" };
  return [series, ...tiles];
}

// every metric the card can show: id, label, format, the 14 values, and
// the change its badge carries. Revenue and ad spend compare with last
// month; every other tile compares the end of its own 14 days with the start,
// so each one wears a badge
export function metricsOf(p) {
  if (p.server) return liveMetrics(p);
  const kind = kindOf(p.kind);
  const series = { id: "series", label: kind.series?.label || "Active users", format: kind.series?.format || "num", values: p.users, delta: pct30(p, p.users.length - 1), deltaLabel: "over the past 30 days" };
  const tiles = kind.tiles.map((t) => {
    const value = tileValue(p, t);
    const values = tileSeries(p, t, value);
    if (t.id === "revenue" && p.baseline) return { id: t.id, label: t.label, format: t.format, values, delta: ((p.revenue - p.baseline) / p.baseline) * 100, deltaLabel: "on last month" };
    if (t.id === "adSpend" && p.adSpendLast) return { id: t.id, label: t.label, format: t.format, values, delta: ((p.adSpend - p.adSpendLast) / p.adSpendLast) * 100, deltaLabel: "on last month" };
    const start = values[0];
    const delta = t.format === "pct" ? values.at(-1) - start : start ? ((values.at(-1) - start) / start) * 100 : 0;
    return { id: t.id, label: t.label, format: t.format, values, delta, deltaLabel: "over the past 14 days" };
  });
  return [series, ...tiles];
}

const deltaPill = (m, cls = "c-stat__delta") =>
  m.delta === null ? "" : `<span class="${cls}${m.delta < 0 ? ` ${cls}--down` : ""}" data-delta="${m.id}" role="img" aria-label="${m.delta < 0 ? "Down" : "Up"} ${Math.abs(m.delta).toFixed(1)}% ${m.deltaLabel}">${icon("arrow-up")}<span aria-hidden="true">${Math.abs(m.delta).toFixed(1)}%</span></span>`;

// ---------- the graph ----------

function niceMax(value) {
  if (value <= 0) return 10;
  const step = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / (step / 2)) * (step / 2);
}

function points(values) {
  const max = niceMax(Math.max(...values));
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;
  const days = dayLabels(values.length);
  const denom = Math.max(1, values.length - 1); // a one-point live tile must not divide by zero
  return values.map((v, i) => ({ x: PAD_L + (innerW * i) / denom, y: PAD_T + innerH - (innerH * v) / max, v, day: days[i] }));
}

function ticks(values) {
  const max = niceMax(Math.max(...values));
  const innerH = H - PAD_T - PAD_B;
  return Array.from({ length: 5 }, (_, i) => ({ v: (max * i) / 4, y: PAD_T + innerH - (innerH * i) / 4 }));
}

function graphInner(m) {
  const fmt = formats[m.format] || formats.num;
  const pts = points(m.values);
  const tk = ticks(m.values);
  const last = pts.length - 1;
  const path = pts.map((q, i) => `${i === 0 ? "M" : "L"}${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(" ");
  const dots = pts.map((q, i) => `<circle class="c-graph__dot" cx="${q.x.toFixed(1)}" cy="${q.y.toFixed(1)}" r="3" data-index="${i}" tabindex="0" role="img" aria-label="${q.day}, ${fmt.value(q.v)}"></circle>`).join("");
  const grid = tk.map((t) => `<line class="c-graph__grid" x1="${PAD_L}" y1="${t.y.toFixed(1)}" x2="${W - PAD_R}" y2="${t.y.toFixed(1)}"></line>`).join("");
  const yLabels = tk.map((t) => `<text class="c-graph__axis" x="${PAD_L - 8}" y="${t.y.toFixed(1)}" text-anchor="end" dominant-baseline="middle">${fmt.axis(t.v)}</text>`).join("");
  const xLabels = pts
    .filter((q, i) => (i % 3 === 0 && last - i > 1) || i === last)
    .map((q) => {
      const i = pts.indexOf(q);
      return `<text class="c-graph__axis" x="${q.x.toFixed(1)}" y="${H - 6}" text-anchor="${i === 0 ? "start" : i === last ? "end" : "middle"}">${q.day}</text>`;
    })
    .join("");
  return `<g class="c-graph__grid-group">${grid}</g><path class="c-graph__line" d="${path}"></path><g data-graph-dots>${dots}</g><line class="c-graph__crosshair" x1="0" y1="${PAD_T}" x2="0" y2="${H - PAD_B}" hidden></line><g class="c-graph__axis-group">${yLabels}${xLabels}</g>`;
}

const bigMarkup = (m) => `<div class="c-graph panel app-graph" data-metric="${m.id}" style="view-transition-name: metric-${m.id}">
  <div class="c-graph__head"><span class="c-graph__label">${m.label}</span><span class="c-graph__value" data-value="${m.id}">${(formats[m.format] || formats.num).value(0)}</span>${deltaPill(m, "c-graph__delta")}</div>
  <svg class="c-graph__svg" viewBox="0 0 ${W} ${H}" role="group" aria-label="${m.label}, last 14 days" data-graph>${graphInner(m)}</svg>
  <div class="c-graph__tip panel" data-graph-tip role="status" aria-live="polite" hidden>
    <span class="c-graph__tip-title">${m.label}</span>
    <span class="c-graph__tip-row"><span class="c-graph__tip-swatch"></span><span class="c-graph__tip-date" data-tip-date></span><span class="c-graph__tip-value" data-tip-value></span></span>
    <span class="c-graph__tip-row c-graph__tip-row--prev"><span class="c-graph__tip-swatch"></span><span class="c-graph__tip-date" data-tip-prev-date></span><span class="c-graph__tip-value" data-tip-prev-value></span></span>
  </div>
</div>`;

const smallMarkup = (m) => `<button type="button" class="c-stat panel app-tile" data-metric="${m.id}" data-swap="${m.id}" style="view-transition-name: metric-${m.id}" aria-label="${m.label}, show on the graph"><span class="c-stat__label">${m.label}</span><span class="c-stat__row"><span class="c-stat__value" data-value="${m.id}">${(formats[m.format] || formats.num).value(0)}</span>${deltaPill(m)}</span></button>`;

// ---------- the card ----------

export function renderRunning(root, projectId) {
  const p = () => project(projectId);
  // the id of the metric on the big card. It was the literal "series", which
  // no longer names anything the moment the tiles come from the goal's own
  // KPIs: the card drew list[0] while `big` still said "series", so a change to
  // the metric it was actually showing never redrew the graph.
  let big = null;
  let hoverIndex = -1;
  let graph = null;
  const metric = (id) => metricsOf(p()).find((m) => m.id === id);

  function paint() {
    const list = metricsOf(p());
    if (!big || !list.some((m) => m.id === big)) big = list[0]?.id ?? null;
    const bigMetric = list.find((m) => m.id === big) || list[0];
    const small = list.filter((m) => m.id !== bigMetric.id);
    root.innerHTML = `<div class="app-running">${bigMarkup(bigMetric)}<div class="app-stats${small.length === 3 || small.length >= 5 ? " app-stats--three" : ""}">${small.map(smallMarkup).join("")}</div></div>`;
    for (const m of list) {
      const el = root.querySelector(`[data-value="${m.id}"]`);
      odometerTo(el, m.values.at(-1), { duration: 700, format: (formats[m.format] || formats.num).value });
    }
    wireGraph();
  }

  function wireGraph() {
    const svg = root.querySelector("[data-graph]");
    const tip = root.querySelector("[data-graph-tip]");
    const m = () => metric(big);
    const fmt = () => formats[m().format] || formats.num;
    const valueEl = root.querySelector(".app-graph [data-value]");
    graph = { svg };
    hoverIndex = -1;

    function setDelta(pct) {
      const badge = root.querySelector(".app-graph [data-delta]");
      if (!badge) return;
      const text = badge.querySelector("span");
      badge.classList.toggle("c-graph__delta--down", pct < 0);
      badge.setAttribute("aria-label", `${pct < 0 ? "Down" : "Up"} ${Math.abs(pct).toFixed(1)}%`);
      odometerTo(text, Math.abs(pct), { from: numberIn(text), duration: 250, format: (n) => `${n.toFixed(1)}%` });
    }

    // the card sits beside the pointer, a little below and to its right,
    // and flips to the left when the right edge of the card would run out;
    // with no pointer (keyboard focus) it sits over the point itself
    const card = root.querySelector(".app-graph");
    function place(pointer, q) {
      const box = card.getBoundingClientRect();
      const svgBox = svg.getBoundingClientRect();
      const x = pointer ? pointer.x - box.left : svgBox.left - box.left + (q.x / W) * svgBox.width;
      const y = pointer ? pointer.y - box.top : svgBox.top - box.top + (q.y / H) * svgBox.height;
      const gap = 14;
      const w = tip.offsetWidth;
      const h = tip.offsetHeight;
      const left = x + gap + w > box.width - 8 ? Math.max(8, x - gap - w) : x + gap;
      const top = Math.max(8, Math.min(box.height - h - 8, y + gap));
      tip.style.right = "auto";
      tip.style.left = "0";
      tip.style.top = "0";
      tip.style.transform = `translate(${left}px, ${top}px)`;
    }

    function hover(index, pointer = null) {
      const pts = points(m().values);
      const i = Math.max(0, Math.min(pts.length - 1, index));
      const q = pts[i];
      const prev = pts[Math.max(0, i - 1)];
      const changed = i !== hoverIndex;
      hoverIndex = i;
      const cross = svg.querySelector(".c-graph__crosshair");
      cross.setAttribute("x1", q.x);
      cross.setAttribute("x2", q.x);
      cross.removeAttribute("hidden");
      for (const dot of svg.querySelectorAll(".c-graph__dot")) dot.classList.toggle("is-active", Number(dot.dataset.index) === i);
      tip.hidden = false;
      root.querySelector("[data-tip-date]").textContent = q.day;
      root.querySelector("[data-tip-value]").textContent = fmt().value(q.v);
      root.querySelector("[data-tip-prev-date]").textContent = prev.day;
      root.querySelector("[data-tip-prev-value]").textContent = fmt().value(prev.v);
      tip.querySelector(".c-graph__tip-row--prev").hidden = i === 0;
      place(pointer, q);
      if (changed) {
        odometerTo(valueEl, q.v, { from: numberIn(valueEl), duration: 250, format: fmt().value });
        if (big === "series") setDelta(pct30(p(), i));
      }
    }

    function leave() {
      svg.querySelector(".c-graph__crosshair").setAttribute("hidden", "");
      for (const dot of svg.querySelectorAll(".c-graph__dot")) dot.classList.remove("is-active");
      tip.hidden = true;
      hoverIndex = -1;
      odometerTo(valueEl, m().values.at(-1), { from: numberIn(valueEl), duration: 300, format: fmt().value });
      if (big === "series") setDelta(pct30(p(), p().users.length - 1));
    }

    const indexFromX = (clientX) => {
      const rect = svg.getBoundingClientRect();
      const innerLeft = rect.left + (PAD_L / W) * rect.width;
      const innerWidth = ((W - PAD_L - PAD_R) / W) * rect.width;
      return Math.round(((clientX - innerLeft) / innerWidth) * Math.max(1, m().values.length - 1));
    };

    svg.addEventListener("pointermove", (e) => hover(indexFromX(e.clientX), { x: e.clientX, y: e.clientY }));
    svg.addEventListener("pointerleave", leave);
    svg.addEventListener("mousedown", (e) => e.preventDefault());
    svg.addEventListener("focusin", (e) => {
      const dot = e.target.closest(".c-graph__dot");
      if (dot) hover(Number(dot.dataset.index));
    });
    svg.addEventListener("focusout", (e) => {
      if (!svg.contains(e.relatedTarget)) leave();
    });
    svg.addEventListener("keydown", (e) => {
      const dot = e.target.closest(".c-graph__dot");
      if (!dot) return;
      const dots = [...svg.querySelectorAll(".c-graph__dot")];
      const i = Number(dot.dataset.index);
      if (e.key === "ArrowRight" && i < dots.length - 1) dots[i + 1].focus();
      else if (e.key === "ArrowLeft" && i > 0) dots[i - 1].focus();
      else return;
      e.preventDefault();
    });
  }

  // a small tile takes the big spot: the two morph between places (the
  // View Transitions API when the browser has it, a plain redraw when not)
  function swap(id) {
    if (id === big || !metric(id)) return;
    const run = () => {
      big = id;
      paint();
      root.querySelector(".app-graph")?.focus?.();
    };
    if (document.startViewTransition && !reduceMotion()) {
      // only the two cards move: the root is told to sit still
      document.documentElement.dataset.vt = "swap";
      const vt = document.startViewTransition(run);
      vt.finished.finally(() => delete document.documentElement.dataset.vt);
    } else run();
  }

  root.addEventListener("click", (e) => {
    const tile = e.target.closest("[data-swap]");
    if (tile) swap(tile.dataset.swap);
  });
  paint();

  // a number moved in the store: the card carrying it rolls to the new
  // value, and the graph redraws if it is the one on show
  function refresh(id) {
    const m = metric(id);
    if (!m) return;
    const el = root.querySelector(`[data-value="${id}"]`);
    if (el && hoverIndex === -1) odometerTo(el, m.values.at(-1), { from: numberIn(el), duration: 600, format: (formats[m.format] || formats.num).value });
    const badge = root.querySelector(`[data-delta="${id}"]`);
    if (badge && m.delta !== null) {
      badge.classList.toggle(badge.classList.contains("c-graph__delta") ? "c-graph__delta--down" : "c-stat__delta--down", m.delta < 0);
      odometerTo(badge.querySelector("span"), Math.abs(m.delta), { from: numberIn(badge.querySelector("span")), duration: 400, format: (n) => `${n.toFixed(1)}%` });
    }
    if (id === big && hoverIndex === -1 && graph?.svg?.isConnected) graph.svg.innerHTML = graphInner(m);
  }

  const off = subscribe((topic, payload) => {
    if (!root.isConnected) return;
    if (topic === "revenue" && payload.id === projectId) refresh("revenue");
    // the series that moved belongs to the KPI on the big card: redraw THAT,
    // not an id that no longer exists
    else if (topic === "users" && payload.id === projectId) refresh(big);
    else if (topic === "stats" && payload.project.id === projectId) refresh(payload.tile);
  });
  return () => off();
}
