// home.js: every project at once, each tile carrying its name and the
// line its assistant is thinking right now; a green count for new
// thoughts, an orange one when it needs an answer. New starts a project;
// the field finds one.
import { icon } from "../icons.js";
import { navigate, projectPath } from "../router.js";
import { connectorsPending, createProject, get, listed, subscribe } from "../store.js";
import { EASE_OUT, announce, escapeHtml, reduceMotion, riseIn } from "../util.js";

const TILE_SHAPE = Math.log(2.2);
const count = (n) => (n > 9 ? "9+" : String(n));

// the orange count is everything waiting on you: open questions plus
// connectors still to be solved
const needsOf = (p) => (p.needs || 0) + connectorsPending(p);
function badges(p) {
  const n = needsOf(p);
  const needs = n ? `<span class="btn__dot c-dash__badge c-dash__badge--needs" data-kind="needs" data-count="${count(n)}" role="img" aria-label="Needs you, ${n} waiting"></span>` : "";
  const unread = p.unread ? `<span class="btn__dot c-dash__badge" data-kind="unread" data-count="${count(p.unread)}" role="img" aria-label="${p.unread} unread"></span>` : "";
  return `<span class="c-dash__badges">${needs}${unread}</span>`;
}

// the sim indexes its thought list by step; a live-backed project arrives
// with none, so fall back to its live status line, then a quiet ellipsis
const thinkLine = (p) => (p.thoughts && p.thoughts[p.step]) || p.liveStatus || "…";
const think = (p) => `${icon("loader-circle", "btn__spinner")}<span>${escapeHtml(thinkLine(p))}</span>`;

const tile = (p) => `<a class="c-dash__tile${needsOf(p) ? " has-needs" : ""}" role="listitem" href="#${projectPath(p.id)}" data-dash="${p.id}">
  ${badges(p)}
  <span class="c-dash__name">${escapeHtml(p.name)}</span>
  <span class="c-dash__think" data-dash-think>${think(p)}</span>
</a>`;

// New: a project lands at once and its chat opens; rename it from the
// chat's menu whenever you like
// New opens the one draft chat, making it if there is none; it becomes a
// project, and a row in the rail, only once its first message is sent
export function startNewProject() {
  const draft = get().projects.find((p) => p.draft) || createProject({ name: "New Project", draft: true });
  navigate(projectPath(draft.id));
}

export function render(root) {
  let query = "";
  root.innerHTML = `<section class="app-home"><div class="c-dash panel app-dash" id="dash">
  <div class="c-dash__head">
    <span class="c-dash__heading"><span class="c-dash__title">Projects</span><span class="c-dash__meta" data-dash-count></span></span>
    <span class="app-home__tools"><label class="app-search">${icon("search")}<input class="app-search__input" type="search" placeholder="Find a project" aria-label="Find a project" autocomplete="off"></label><a class="btn btn--icon" href="#/activity" aria-label="Activity">${icon("inbox")}</a><a class="btn btn--icon" href="#/settings/account" aria-label="Settings">${icon("settings")}</a></span>
  </div>
  <div class="c-dash__grid" role="list" aria-label="Projects" data-dash-grid></div>
  <div class="app-empty" data-dash-empty hidden><p data-dash-empty-text></p><button type="button" class="btn" data-dash-empty-action></button></div>
</div></section>`;
  const grid = root.querySelector("[data-dash-grid]");
  const empty = root.querySelector("[data-dash-empty]");

  // the tiles fill the frame whatever their number: pick the column count
  // whose tiles come closest to three wide to one tall, never under 150px
  function layout() {
    const n = [...grid.children].filter((c) => !c.hidden).length;
    const gap = parseFloat(getComputedStyle(grid).gap) || 0;
    const width = grid.clientWidth;
    const height = grid.clientHeight;
    let best = { cols: 4, rows: Math.ceil(n / 4), score: Infinity };
    for (let cols = 1; cols <= n; cols++) {
      const rows = Math.ceil(n / cols);
      const w = (width - gap * (cols - 1)) / cols;
      const h = (height - gap * (rows - 1)) / rows;
      if (w < 150) break;
      const score = Math.abs(Math.log(w / h) - TILE_SHAPE);
      if (score < best.score) best = { cols, rows, score };
    }
    grid.style.gridTemplateColumns = `repeat(${best.cols}, minmax(0, 1fr))`;
    grid.style.gridTemplateRows = `repeat(${best.rows}, minmax(0, 1fr))`;
  }

  function paint() {
    const list = listed();
    grid.innerHTML = `${list.map(tile).join("")}<button type="button" class="c-dash__tile c-dash__tile--new" data-dash-new role="listitem">${icon("plus")}<span>New</span></button>`;
    root.querySelector("[data-dash-count]").textContent = `${list.length} running`;
    applyQuery();
  }

  function applyQuery() {
    const q = query.trim().toLowerCase();
    let shown = 0;
    for (const t of grid.querySelectorAll("[data-dash]")) {
      const on = !q || t.querySelector(".c-dash__name").textContent.toLowerCase().includes(q);
      t.hidden = !on;
      if (on) shown += 1;
    }
    grid.querySelector("[data-dash-new]").hidden = Boolean(q);
    const none = listed().length === 0;
    empty.hidden = !(none || (q && shown === 0));
    if (none) {
      root.querySelector("[data-dash-empty-text]").textContent = "No projects yet. Start one and its assistant reads the brief.";
      root.querySelector("[data-dash-empty-action]").textContent = "New project";
    } else if (q && shown === 0) {
      root.querySelector("[data-dash-empty-text]").textContent = `Nothing is called "${query.trim()}".`;
      root.querySelector("[data-dash-empty-action]").textContent = "Clear the search";
    }
    layout();
  }

  function paintBadges(p) {
    const t = grid.querySelector(`[data-dash="${p.id}"]`);
    if (!t) return;
    const before = new Set([...t.querySelectorAll(".c-dash__badge")].map((b) => b.dataset.kind));
    t.querySelector(".c-dash__badges").outerHTML = badges(p);
    t.classList.toggle("has-needs", needsOf(p) > 0);
    if (reduceMotion()) return;
    for (const badge of t.querySelectorAll(".c-dash__badge")) {
      if (before.has(badge.dataset.kind)) continue;
      badge.animate([{ scale: "0.4", opacity: 0 }, { scale: "1.12", opacity: 1, offset: 0.7 }, { scale: "1", opacity: 1 }], { duration: 320, easing: EASE_OUT });
    }
  }

  root.addEventListener("click", (e) => {
    if (e.target.closest("[data-dash-new]")) return startNewProject();
    if (e.target.closest("[data-dash-empty-action]")) {
      if (listed().length === 0) return startNewProject();
      query = "";
      root.querySelector(".app-search__input").value = "";
      applyQuery();
    }
  });
  root.querySelector(".app-search__input").addEventListener("input", (e) => {
    query = e.target.value;
    applyQuery();
  });
  root.querySelector(".app-search__input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const first = [...grid.querySelectorAll("[data-dash]")].find((t) => !t.hidden);
      if (first) navigate(projectPath(first.dataset.dash));
    }
  });

  paint();
  let frame;
  const onResize = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(layout);
  };
  addEventListener("resize", onResize);
  requestAnimationFrame(layout);

  const off = subscribe((topic, payload) => {
    if (!root.isConnected) return;
    if (topic === "project:think") {
      const el = grid.querySelector(`[data-dash="${payload.id}"] [data-dash-think]`);
      if (!el) return;
      el.innerHTML = think(payload);
      riseIn(el, { y: 3 });
    } else if (topic === "project:badges") {
      paintBadges(payload);
    } else if (topic === "projects" || topic === "reset") {
      paint();
    }
  });
  return () => {
    off();
    removeEventListener("resize", onResize);
  };
}
