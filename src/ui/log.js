// log.js: the project's own activity, at the right of its chat: the
// missions it is on right now with their bars, then everything it did,
// found, sold and asked, newest first.
import { icon } from "../icons.js";
import { kindOf } from "../kinds.js";
import { doneEffect, project, railLane, setRailLane, subscribe } from "../store.js";
import { EASE_STD, escapeHtml, reduceMotion, relTime, richText, riseIn } from "../util.js";

const KIND_ICONS = { work: "check", sale: "arrow-up-right", insight: "zap", mission: "badge-check", breakthrough: "sparkles", needs: "circle-help", setup: "shield-check", user: "user", video: "clapperboard", lead: "mail", signup: "user", order: "inbox", payout: "receipt", invoice: "receipt", run: "activity", error: "circle-alert", note: "file-text", send: "mail", subscriber: "user", view: "eye" };
const FILTERS = [["all", "All"], ["work", "Work"], ["insight", "Insights"], ["sale", "Sales"], ["needs", "Asks"]];

// how a finished task reads before it leaves the card, picked from the
// chat-head menu: the mark turns to a check; the title is struck through;
// the row folds shut as it goes; the row flashes green
export const DONE_FX = [
  { id: "check", label: "Check mark" },
  { id: "strike", label: "Strike through" },
  { id: "fold", label: "Fold away" },
  { id: "flash", label: "Green flash" },
];
// the flash keeps the number; the others say Done with a check for a mark
const doneWord = () => doneEffect() !== "flash";

// live missions carry a phase (frame/plan/...), not the sim's steps array
const missionStep = (m) => (m.progress >= 100 ? "Done" : m.steps ? m.steps[Math.min(m.steps.length - 1, Math.floor((m.progress / 100) * m.steps.length))] : m.phase || "Working");
const missionThink = (m) => `${m.progress >= 100 ? icon("check") : icon("loader-circle", "btn__spinner")}<span data-mission-step>${missionStep(m)}</span>`;

// a manager's mission carries its site as a link; a subagent's task is
// short and stays plain
const missionRow = (m) => {
  const done = m.progress >= 100;
  const mark = icon(done && doneWord() ? "check" : m.icon || "badge-check");
  return `<div class="c-missions__item${done ? " is-done" : ""}${m.lane === "subagent" ? " is-quick" : ""}" role="listitem" data-mission="${m.id}">
  ${m.url ? `<a class="c-missions__mark" href="${m.url}" target="_blank" rel="noopener" aria-label="Open ${m.site}">${mark}</a>` : `<span class="c-missions__mark">${mark}</span>`}
  <div class="c-missions__body">
    <div class="c-missions__row"><span class="c-missions__title">${escapeHtml(m.title)}</span>${m.site ? `<span class="c-missions__site">${m.site}</span>` : ""}<span class="c-missions__pct" data-mission-pct>${done && doneWord() ? "Done" : `${m.progress}%`}</span></div>
    <div class="c-missions__bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${m.progress}" aria-label="${m.title}"><span data-mission-fill style="transform: scaleX(${m.progress / 100})"></span></div>
    <span class="c-missions__think" data-mission-think>${missionThink(m)}</span>
  </div>
</div>`;
};

// the moment a row reaches 100: it reads as done in the chosen way
function markDone(rowEl) {
  rowEl.classList.add("is-done");
  if (!doneWord()) return;
  rowEl.querySelector(".c-missions__mark").innerHTML = icon("check");
  rowEl.querySelector("[data-mission-pct]").textContent = "Done";
}

// how a finished row leaves: folded shut, or faded off to the right
function leave(rowEl) {
  if (doneEffect() === "fold") {
    const cs = getComputedStyle(rowEl);
    rowEl.style.overflow = "hidden";
    return rowEl.animate(
      [{ height: `${rowEl.offsetHeight}px`, paddingTop: cs.paddingTop, paddingBottom: cs.paddingBottom, opacity: 1 }, { height: "0px", paddingTop: "0px", paddingBottom: "0px", opacity: 0 }],
      { duration: 240, easing: EASE_STD, fill: "forwards" },
    );
  }
  return rowEl.animate([{ opacity: 1, transform: "translateX(0)" }, { opacity: 0, transform: "translateX(10px)" }], { duration: 180, easing: EASE_STD, fill: "forwards" });
}

const entryRow = (n) => `<li class="app-log__row" role="listitem" data-kind="${n.kind}">
  <span class="app-log__mark">${icon(KIND_ICONS[n.kind] || "bell")}</span>
  <span class="app-row__text"><span class="app-log__text">${richText(n.text)}</span><span class="app-row__sub">${relTime(n.at)}</span></span>
  ${n.delta !== undefined ? `<span class="c-insights__delta${n.delta < 0 ? " c-insights__delta--down" : ""}" role="img" aria-label="${n.delta < 0 ? "Down" : "Up"} ${Math.abs(n.delta)}%">${icon("arrow-up")}<span aria-hidden="true">${Math.abs(n.delta)}%</span></span>` : ""}
</li>`;

// what is worth a look on its own: not every step of work, but what it
// found, sold, broke through on, asked, and set up
const UPDATE_KINDS = new Set(["insight", "sale", "breakthrough", "needs", "setup"]);

// the list is exactly as tall as its first n rows, whatever their heights,
// and scrolls the rest; with n rows or fewer it is as tall as it needs
function fitRows(list, n) {
  const rows = list.children;
  if (rows.length <= n) {
    list.style.maxHeight = "";
    list.style.minHeight = rows.length ? `${list.scrollHeight}px` : "";
    return;
  }
  const h = rows[n].offsetTop - rows[0].offsetTop;
  list.style.maxHeight = `${h}px`;
  list.style.minHeight = `${h}px`;
}
const TITLES = { full: "Activity", tasks: "Tasks", updates: "Updates" };
// the two lanes of work the Tasks card can show
const LANES = [["manager", "Manager"], ["subagent", "Subagents"]];
// the subagents' lane shows this many rows and scrolls the rest; the
// manager's shows every one of its few
const QUICK_ROWS = 2;
const laneChips = () => `<div class="c-insights__filters app-log__lanes" role="group" aria-label="Whose work">${LANES.map(([id, label]) => `<button type="button" class="c-insights__filter" data-lane="${id}" aria-pressed="${id === railLane()}">${label}</button>`).join("")}</div>`;

// mode: full is the missions then everything; tasks is the missions alone;
// updates is the log cut down to what is worth seeing
export function renderLog(root, projectId, { mode = "full" } = {}) {
  const p = () => project(projectId);
  let filter = "all";
  // the updates card's tabs are the kind's own: Videos on a channel, Leads
  // on outreach, Orders on a store; what those tabs show is kept as well
  const tabs = kindOf(p().kind).updates || FILTERS.filter(([id]) => id !== "work" && id !== "all");
  const tabKinds = new Set(tabs.map(([id]) => id));
  const keep = (n) => mode !== "updates" || UPDATE_KINDS.has(n.kind) || tabKinds.has(n.kind);
  // the full card's tabs are the kind's own when it names them (a channel
  // reads Videos, Breakthroughs, Insights), the generic five otherwise. A
  // tab may list the log kinds it gathers; without a list it is one kind
  const own = mode === "full" ? kindOf(p().kind).activity : null;
  const filters = mode === "updates" ? [["all", "All"], ...tabs] : own ? [["all", "All"], ...own] : FILTERS;
  const kindsOf = new Map(filters.map(([id, , kinds]) => [id, new Set(kinds || [id])]));
  const matches = (n) => filter === "all" || kindsOf.get(filter)?.has(n.kind);
  root.innerHTML = `<section class="panel app-log app-log--${mode}" aria-label="${TITLES[mode]}" data-done-fx="${doneEffect()}">
  <div class="app-log__head"><span class="c-dash__heading"><span class="c-dash__title">${TITLES[mode]}</span><span class="c-dash__meta" data-log-count></span></span>${mode === "tasks" ? laneChips() : `<div class="c-insights__filters" role="group" aria-label="Kind">${filters.map(([id, label]) => `<button type="button" class="c-insights__filter" data-log-filter="${id}" aria-pressed="${id === "all"}">${label}</button>`).join("")}</div>`}</div>
  ${mode === "full" ? laneChips() : ""}
  ${mode === "updates" ? "" : `<div class="app-log__missions" data-missions role="list" aria-label="Work in progress"></div>`}
  ${mode === "tasks" ? "" : `<ul class="app-log__list" data-log-list role="list"></ul>`}
  <div class="app-rows__empty" data-log-empty hidden><span data-log-empty-text></span></div>
</section>`;

  const laneOf = () => railLane();
  // the updates card shows three rows, two once the rail says space is
  // short (is-tight on the cards container, set by the rail's fit)
  const updateRows = () => (root.closest("[data-rail-cards]")?.classList.contains("is-tight") ? 2 : 3);
  // the subagents' tasks queue with the nearest to done at the top, so
  // what completes is in view; the manager's few keep their order
  const inLane = () => {
    const rows = p().missions.filter((m) => m.lane === laneOf());
    return laneOf() === "subagent" ? rows.sort((a, b) => b.progress - a.progress) : rows;
  };
  function paintMissions() {
    const el = root.querySelector("[data-missions]");
    if (!el) return;
    el.innerHTML = inLane().map(missionRow).join("");
    if (laneOf() === "subagent") fitRows(el, QUICK_ROWS);
    else el.style.maxHeight = el.style.minHeight = "";
    for (const chip of root.querySelectorAll("[data-lane]")) chip.setAttribute("aria-pressed", String(chip.dataset.lane === laneOf()));
  }

  function paint() {
    const count = root.querySelector("[data-log-count]");
    const empty = root.querySelector("[data-log-empty]");
    if (mode === "tasks") {
      const lane = inLane();
      const open = lane.filter((m) => m.progress < 100).length;
      // the label reads the rows' own state: nothing open means the rows
      // that are left are the ones that finished, so it counts those
      count.textContent = p().paused ? "Paused" : open ? `${open} running` : lane.length ? `${lane.length} done` : "";
      empty.hidden = lane.length > 0;
      root.querySelector("[data-log-empty-text]").textContent = laneOf() === "manager" ? "No missions yet. The manager's first one lands here." : "No tasks yet. The subagents' first ones land here.";
      return;
    }
    const all = p().activity.filter(keep);
    const shown = all.filter(matches);
    const list = root.querySelector("[data-log-list]");
    list.innerHTML = shown.map(entryRow).join("");
    if (mode === "updates") fitRows(list, updateRows());
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const n = all.filter((x) => x.at >= today.getTime()).length;
    count.textContent = n ? `${n} today` : `${all.length} in the log`;
    empty.hidden = shown.length > 0;
    root.querySelector("[data-log-empty-text]").textContent = all.length ? "Nothing of this kind yet." : mode === "updates" ? "Nothing worth a look yet. Insights, sales and asks land here." : "Nothing yet. The agent's first move lands here.";
    for (const chip of root.querySelectorAll("[data-log-filter]")) chip.setAttribute("aria-pressed", String(chip.dataset.logFilter === filter));
  }

  root.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-log-filter]");
    if (chip) {
      filter = chip.dataset.logFilter;
      paint();
    }
    const lane = e.target.closest("[data-lane]");
    if (lane && lane.dataset.lane !== laneOf()) setRailLane(lane.dataset.lane);
  });
  paintMissions();
  paint();

  // a retiring row's fade is in flight: the next task waits for it before
  // it takes the row's place
  let settling = null;
  const off = subscribe((topic, payload) => {
    if (!root.isConnected) return;
    if (topic === "activity" && payload.id === projectId) {
      if (mode === "tasks" || !keep(payload.item)) return;
      paint();
      if (matches(payload.item)) riseIn(root.querySelector("[data-log-list]").firstElementChild, { y: 4 });
    } else if (topic === "rail:lane") {
      paintMissions();
      if (mode === "tasks") paint();
    } else if (topic === "pause" && payload.id === projectId) {
      if (mode === "tasks") paint();
    } else if (topic === "rail:done") {
      root.firstElementChild.dataset.doneFx = payload.done;
      paintMissions();
    } else if (topic === "mission:new" && payload.project.id === projectId) {
      if (payload.mission.lane !== laneOf()) return;
      const show = () => {
        if (!root.isConnected) return;
        paintMissions();
        if (mode === "tasks") paint();
        riseIn(root.querySelector(`[data-mission="${payload.mission.id}"]`), { y: 6 });
      };
      if (settling) settling.then(show);
      else show();
    } else if (topic === "mission:gone" && payload.project.id === projectId) {
      // the finished row folds away before the list settles
      const rowEl = root.querySelector(`[data-mission="${payload.mission.id}"]`);
      if (!rowEl) return;
      const settle = () => {
        settling = null;
        paintMissions();
        if (mode === "tasks") paint();
      };
      if (reduceMotion()) return settle();
      settling = leave(rowEl).finished.then(settle, settle);
    } else if (topic === "mission" && payload.project.id === projectId) {
      const m = payload.mission;
      if (m.lane !== laneOf()) return;
      if (mode === "tasks") paint();
      const rowEl = root.querySelector(`[data-mission="${m.id}"]`);
      if (!rowEl) return paintMissions();
      rowEl.querySelector("[data-mission-pct]").textContent = `${m.progress}%`;
      rowEl.querySelector("[data-mission-fill]").style.transform = `scaleX(${m.progress / 100})`;
      rowEl.querySelector("[role=progressbar]").setAttribute("aria-valuenow", m.progress);
      const think = rowEl.querySelector("[data-mission-think]");
      if (think.querySelector("[data-mission-step]").textContent !== missionStep(m)) {
        think.innerHTML = missionThink(m);
        riseIn(think, { y: 3 });
      }
      if (m.progress < 100) return;
      // a finished task of the subagents' steps to the top so it is in
      // view while it reads as done
      const list = rowEl.parentElement;
      if (laneOf() === "subagent" && rowEl !== list.firstElementChild) {
        list.prepend(rowEl);
        list.scrollTop = 0;
        riseIn(rowEl, { y: 4 });
      }
      markDone(rowEl);
    }
  });

  // the fitted lists measure their rows again when the card's width
  // settles (the rail's column animates open after setup, and a list
  // measured at a sliver of width caps far too high) and when the rail
  // says space is short
  const refit = () => {
    const missions = root.querySelector("[data-missions]");
    if (missions && laneOf() === "subagent") fitRows(missions, QUICK_ROWS);
    const list = root.querySelector("[data-log-list]");
    if (list && mode === "updates") fitRows(list, updateRows());
  };
  root.addEventListener("rail:fit", refit);
  let lastWidth = root.getBoundingClientRect().width;
  const sizes = new ResizeObserver(() => {
    const width = root.getBoundingClientRect().width;
    if (width === lastWidth) return;
    lastWidth = width;
    refit();
  });
  sizes.observe(root);
  return () => {
    off();
    sizes.disconnect();
  };
}
