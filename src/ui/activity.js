// activity.js: everything that happened, newest first, grouped by day.
// The bell shows the last dozen; this page keeps the whole log.
import { icon } from "../icons.js";
import { navigate, projectPath } from "../router.js";
import { clearNotifications, get, markAllRead, subscribe } from "../store.js";
import { announce, dayLabel, escapeHtml, timeOf } from "../util.js";
import { confirmDialog } from "./dialog.js";
import { renderDaemon } from "./daemon.js";

// every kind the server emits, plus the client's own: a notification whose kind
// is missing here is not an error (icon() falls back to the bell) but it is a
// hole, so the set is kept whole. Server: insight/sale/system/needs (the
// telemetry bell), plug (a connect), report (the weekly), billing (a cap),
// security (an ops finding), upload/model (the client's own pushes). The rest
// are the metric outcomes and the sim's kinds, which arrive by the same route.
const KIND_ICONS = {
  insight: "zap", sale: "arrow-up-right", system: "bell", needs: "circle-help",
  plug: "external-link", report: "file-text", billing: "credit-card", security: "shield-check",
  upload: "check", model: "sun-moon",
  work: "check", mission: "badge-check", breakthrough: "sparkles", setup: "shield-check", user: "user",
  video: "clapperboard", lead: "mail", signup: "user", order: "inbox", payout: "receipt",
  invoice: "receipt", run: "activity", error: "circle-alert", note: "file-text", send: "mail",
  subscriber: "user", view: "eye",
};
const FILTERS = [["all", "All"], ["needs", "Needs you"], ["insight", "Insights"], ["sale", "Sales"], ["upload", "Done"], ["system", "System"]];

function row(n) {
  const p = n.projectId ? get().projects.find((x) => x.id === n.projectId) : null;
  return `<li class="app-activity__row${n.read ? "" : " is-unread"}">${icon(KIND_ICONS[n.kind] || "bell")}<span class="app-row__text"><span class="app-row__title">${escapeHtml(n.text)}</span><span class="app-row__sub">${p ? `<a class="app-link" href="#${projectPath(p.id)}">${escapeHtml(p.name)}</a>` : "Workspace"}</span></span><span class="app-activity__time">${timeOf(n.at)}</span></li>`;
}

export function render(root) {
  // there is no activity log on a phone: the page sends you home
  if (matchMedia("(max-width: 720px)").matches) {
    setTimeout(() => navigate("/", { replace: true }), 0);
    return () => {};
  }
  document.title = "Activity";
  let filter = "all";
  root.innerHTML = `<section class="app-activity panel">
  <div data-daemon></div>
  <div class="app-activity__head">
    <span class="c-dash__heading"><span class="c-dash__title">Activity</span><span class="c-dash__meta" data-activity-count></span></span>
    <div class="c-insights__filters" role="group" aria-label="Kind">${FILTERS.map(([id, label]) => `<button type="button" class="c-insights__filter" data-filter="${id}" aria-pressed="${id === "all"}">${label}</button>`).join("")}</div>
    <span class="c-composer__spacer"></span>
    <button type="button" class="btn btn--quiet" data-readall>${icon("check-check")}<span class="btn__label">Mark all read</span></button>
    <button type="button" class="btn btn--quiet" data-clear>${icon("trash")}<span class="btn__label">Clear</span></button>
  </div>
  <div data-activity-list></div>
  <div class="app-empty" data-activity-empty hidden><p data-empty-text></p><a class="btn" href="#/">Open a project</a></div>
</section>`;
  const list = root.querySelector("[data-activity-list]");
  // the improvement daemon keeps its own quiet panel above the log
  const offDaemon = renderDaemon(root.querySelector("[data-daemon]"));

  function paint() {
    const all = get().notifications;
    const shown = all.filter((n) => filter === "all" || n.kind === (filter === "system" ? n.kind === "model" ? "model" : "system" : filter));
    const groups = new Map();
    for (const n of shown) {
      const key = dayLabel(n.at);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(n);
    }
    list.innerHTML = [...groups].map(([day, items]) => `<h2 class="app-activity__day">${day}</h2><ul class="app-rows">${items.map(row).join("")}</ul>`).join("");
    const unread = all.filter((n) => !n.read).length;
    root.querySelector("[data-activity-count]").textContent = `${all.length} in the log${unread ? `, ${unread} unread` : ""}`;
    root.querySelector("[data-readall]").disabled = unread === 0;
    root.querySelector("[data-clear]").disabled = all.length === 0;
    const empty = root.querySelector("[data-activity-empty]");
    empty.hidden = shown.length > 0;
    root.querySelector("[data-empty-text]").textContent = all.length === 0 ? "Nothing in the log yet. What your projects do lands here." : "Nothing of this kind yet.";
    for (const chip of root.querySelectorAll("[data-filter]")) chip.setAttribute("aria-pressed", String(chip.dataset.filter === filter));
  }

  root.addEventListener("click", async (e) => {
    const chip = e.target.closest("[data-filter]");
    if (chip) {
      filter = chip.dataset.filter;
      return paint();
    }
    if (e.target.closest("[data-readall]")) {
      markAllRead();
      return announce("All read");
    }
    if (e.target.closest("[data-clear]")) {
      if (!(await confirmDialog({ title: "Clear the log?", text: "Every notification goes. New ones keep landing.", action: "Clear log", danger: true }))) return;
      clearNotifications();
      announce("Log cleared");
      return;
    }
    const link = e.target.closest("a.app-link");
    if (link) {
      e.preventDefault();
      navigate(link.getAttribute("href").slice(1));
    }
  });
  paint();
  const off = subscribe((topic) => {
    if (root.isConnected && (topic === "notification" || topic === "notifications:read" || topic === "reset")) paint();
  });
  return () => {
    off();
    offDaemon();
  };
}
