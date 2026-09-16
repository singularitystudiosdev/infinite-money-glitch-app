// subagents.js: the project rail's Subagents card — a form that spawns
// parallel scoped worker subagents (task, model, tool scope, how many),
// and the list of what is running or has finished, results included.
import { icon } from "../icons.js";
import { project, subscribe } from "../store.js";
import { spawnSubagents } from "../live.js";
import { escapeHtml } from "../util.js";

// the models the backend allows, in picker order
// (Claude Agent SDK aliases: the backend maps them in llm.js mapModel)
const SUB_MODELS = [
  { name: "sonnet", label: "Sonnet 5", hint: "Balanced" },
  { name: "opus", label: "Opus 5", hint: "Strongest" },
  { name: "haiku", label: "Haiku 4.5", hint: "Fastest, cheapest" },
];

// the tool families a subagent can be scoped to, matching the backend's
const FAMILIES = [
  { id: "shell", label: "Shell", hint: "run commands" },
  { id: "files", label: "Files", hint: "read and write the workspace" },
  { id: "web", label: "Web", hint: "fetch pages, search" },
  { id: "browser", label: "Browser", hint: "drive a real browser" },
  { id: "media", label: "Media", hint: "images, voice, ffmpeg" },
  { id: "youtube", label: "YouTube", hint: "upload and check" },
  { id: "memory", label: "Memory", hint: "project key/value store" },
];

const STATUS_ICON = {
  running: "loader-circle",
  done: "check",
  failed: "circle-alert",
};

// the thinking display: a running worker shows its latest tool-level thoughts
// (server-pushed) rotating every 2-6s, instead of the frozen task description
const rotIdx = new Map();
const rotDue = new Map();
const rowMarkup = (d) => {
  const thinking = d.status === "running" && Array.isArray(d.thoughts) && d.thoughts.length > 0;
  const line = thinking ? d.thoughts[(rotIdx.get(d.id) || 0) % d.thoughts.length].text : d.task;
  return `<li class="app-subs__item is-${d.status}" data-sub="${d.id}">
  <span class="app-subs__mark">${icon(STATUS_ICON[d.status] || "circle-help", d.status === "running" ? "app-subs__spin" : "")}</span>
  <span class="app-subs__body">
    <span class="app-subs__name">${escapeHtml(d.name)}<span class="app-subs__meta">${escapeHtml(d.model)}${d.seconds !== undefined ? ` · ${d.seconds}s` : ""}</span></span>
    <span class="app-subs__task${thinking ? " app-subs__think" : ""}">${thinking ? `${icon("loader-circle", "app-subs__thinkspin")}${escapeHtml(line)}` : escapeHtml(d.task)}</span>
    ${d.result ? `<span class="app-subs__result">${escapeHtml(d.result)}</span>` : ""}
  </span>
</li>`;
};

const scopeRow = (f) => `<label class="app-switch"><span class="app-switch__text"><span class="app-switch__label">${f.label}</span><span class="app-switch__hint">${f.hint}</span></span><input type="checkbox" role="switch" class="app-switch__input" data-sub-family="${f.id}" checked><span class="app-switch__track" aria-hidden="true"></span></label>`;

export function renderSubagents(root, projectId) {
  root.innerHTML = `<section class="panel app-subs" aria-label="Subagents">
  <div class="app-subs__head">
    <span class="app-subs__title">${icon("layout-grid")}<span>Subagents</span></span>
    <span class="app-subs__count" data-subs-count></span>
  </div>
  <form class="app-subs__form" data-subs-form>
    <label class="c-card__field"><span class="c-card__label">Task</span><textarea class="c-card__input app-subs__task" data-subs-task rows="2" placeholder="What should the subagents do?" required></textarea></label>
    <div class="app-subs__picks">
      <label class="c-card__field app-field--narrow"><span class="c-card__label">Model</span><span class="c-stripe__pick"><select class="c-card__input c-stripe__select" data-subs-model>${SUB_MODELS.map((m) => `<option value="${m.name}">${m.label}</option>`).join("")}</select>${icon("chevron-down", "c-stripe__chev")}</span></label>
      <label class="c-card__field app-field--narrow"><span class="c-card__label">How many</span><span class="c-stripe__pick"><select class="c-card__input c-stripe__select" data-subs-count>${[1, 2, 3, 4].map((n) => `<option value="${n}">${n}</option>`).join("")}</select>${icon("chevron-down", "c-stripe__chev")}</span></label>
    </div>
    <div class="app-switches" data-subs-scopes>${FAMILIES.map(scopeRow).join("")}</div>
    <div class="app-subs__foot">
      <button type="submit" class="btn" data-subs-launch>${icon("sparkles")}<span>Launch</span></button>
      <span class="app-subs__error" data-subs-error hidden></span>
    </div>
  </form>
  <ul class="app-subs__list" data-subs-list></ul>
  <p class="app-subs__empty" data-subs-empty hidden>None yet. Launch one, or let the agent spawn them itself.</p>
</section>`;

  const list = root.querySelector("[data-subs-list]");
  const empty = root.querySelector("[data-subs-empty]");
  const count = root.querySelector("[data-subs-count]");
  const error = root.querySelector("[data-subs-error]");
  const launch = root.querySelector("[data-subs-launch]");
  const form = root.querySelector("[data-subs-form]");

  function paint() {
    const p = project(projectId);
    const subs = p?.subagents || [];
    list.innerHTML = subs.map(rowMarkup).join("");
    empty.hidden = subs.length > 0;
    const running = subs.filter((d) => d.status === "running").length;
    count.textContent = running ? `${running} running` : subs.length ? `${subs.length} total` : "";
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const task = root.querySelector("[data-subs-task]").value.trim();
    if (!task) return;
    const model = root.querySelector("[data-subs-model]").value;
    const n = Number(root.querySelector("[data-subs-count]").value) || 1;
    const tools = [...root.querySelectorAll("[data-sub-family]")].filter((c) => c.checked).map((c) => c.dataset.subFamily);
    launch.disabled = true;
    error.hidden = true;
    const res = await spawnSubagents(projectId, { task, model, tools, count: n });
    launch.disabled = false;
    if (!res.ok) {
      error.textContent = res.error || "Could not spawn the subagents.";
      error.hidden = false;
      return;
    }
    root.querySelector("[data-subs-task]").value = "";
  });

  const off = subscribe((topic, payload) => {
    if (!root.isConnected) {
      off();
      clearInterval(tick);
      return;
    }
    if (topic === "projects" && payload.changed === projectId) paint();
  });
  // rotate each running worker's visible thought on its own 2-6s cadence
  const tick = setInterval(() => {
    if (!root.isConnected) {
      clearInterval(tick);
      return;
    }
    const p = project(projectId);
    let changed = false;
    for (const d of p?.subagents || []) {
      if (d.status !== "running" || !Array.isArray(d.thoughts) || d.thoughts.length < 2) continue;
      const now = Date.now();
      if (now < (rotDue.get(d.id) || 0)) continue;
      rotDue.set(d.id, now + 2000 + Math.random() * 4000);
      const len = d.thoughts.length;
      rotIdx.set(d.id, ((rotIdx.get(d.id) || 0) + 1 + Math.floor(Math.random() * (len - 1))) % len);
      changed = true;
    }
    if (changed) paint();
  }, 1000);
  paint();
}
