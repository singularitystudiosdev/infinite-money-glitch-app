// store.js: one state tree for the whole app, kept in localStorage, with
// the actions that change it. Views subscribe to topics and patch the DOM
// themselves; nothing here touches the document.
import { CREDIT_PACKS, CREDITS_LOW, GLITCH_INSIGHTS, GLITCH_USERS, MISSION_POOL, NEW_THOUGHTS, QUICK_POOL, SEED_INVOICES, SEED_NEEDS, SEED_NOTIFICATIONS, SEED_PROJECTS, SEED_UNREAD, TEMPLATES } from "./data.js";
import { KINDS, eventText, kindOf } from "./kinds.js";
import { seeded, uid } from "./util.js";

const KEY = "img.state.v4";
const listeners = new Set();
// projects with a run in flight (the user's or the agent's), never persisted
const busy = new Map();
export const today = () => new Date().toISOString().slice(0, 10);

// two lanes of work on every running project: a manager's missions, few
// and long, and a subagent's tasks, many and short. Each lane keeps a
// number running at once, chosen per project; when one finishes and is
// retired the next starts, so the card is a queue rather than a list.
// (Declared before the state loads below, which fills the lanes)
const LANES = ["manager", "subagent"];
const laneTargets = (rnd = Math.random) => {
  // a seeded generator's first value barely varies with its seed; skip it
  rnd();
  const subagent = 3 + Math.floor(rnd() * 3);
  return { manager: 1 + Math.floor(rnd() * 2), subagent };
};
const QUICK_STEPS = ["Starting", "Working through it", "Wrapping up"];

let state = load() ?? seed();
// every running project starts with both lanes filled, the tasks part-way
// along so the queue is already in motion
for (const [i, p] of state.projects.entries()) if (p.setup?.complete) fillLanes(p, seeded(4000 + i * 13), { spread: true });
let saveTimer;

export const get = () => state;

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// a change is saved at most 250 ms after the first one pending: a busy sim
// emits more often than that, so a debounce that restarted on every emit
// could hold a save back for seconds
export function emit(topic, payload) {
  for (const fn of listeners) fn(topic, payload);
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    save();
  }, 250);
}

export function addServerProject(sp) {
  if (project(sp.id)) return project(sp.id);
  state.projects.push({ ...sp, server: true });
  save();
  emit("projects", { changed: sp.id });
  return project(sp.id);
}

// the server snapshot is authoritative on connect: a server-born project the
// server no longer has is a ghost of a deleted run, and its pending-ask
// badge would count a world the backend retired
export function reconcileServerProjects(ids) {
  const keep = new Set(ids);
  let dropped = 0;
  for (const p of [...state.projects]) {
    if (p.server && !p.draft && !keep.has(p.id)) {
      state.projects.splice(state.projects.indexOf(p), 1);
      dropped++;
    }
  }
  if (dropped) {
    save();
    emit("projects", {});
  }
  return dropped;
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (err) {
    console.error(err);
  }
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.version !== 6) return null; // 5 → 6: the operator's accumulated chat/test projects (Hi, Hello, Ping test, …) are discarded on next load
    if (parsed.credits.day !== today()) {
      parsed.credits.day = today();
      parsed.credits.spentToday = 0;
    }
    // a kind may have gained a tile since this state was saved: the saved
    // numbers stay, the new tile gets a starting number of its own
    for (const [i, p] of parsed.projects.entries()) {
      p.stats = { ...statsFor(p, p.kind, seeded(2000 + i * 31)), ...(p.stats || {}) };
      // missions saved before the lanes existed are the manager's; the
      // subagent lane is filled once the state is up
      for (const m of p.missions || []) m.lane ||= "manager";
      // a project that never asks (Yolo) holds no open question: one left
      // from before is closed as skipped
      if (p.mode !== "ask") {
        for (const t of p.thread || []) {
          if (t.kind === "ask" && !t.answered) {
            t.answered = true;
            t.answer = "Skipped";
          }
        }
        p.needs = 0;
      }
      // the kind's demo events are seeded only for new projects (seed(), below):
      // a load-time backfill here re-injected the same fabricated rows into real
      // projects on every reload, so a channel project kept growing fake
      // "Bali cliff sunrise" entries it never produced
    }
    return parsed;
  } catch (err) {
    console.error(err);
    return null;
  }
}

// ---------- seed ----------

// fourteen days of users shaped by the project's size, trending up, and the
// thirty days of history behind them each visible day compares against
function usersFor(revenue, salt) {
  const rnd = seeded(salt);
  const base = Math.max(60, Math.round(revenue / 40));
  const users = Array.from({ length: 14 }, (_, i) => Math.round(base * (1 + i * 0.045) * (0.94 + rnd() * 0.12)));
  const history = Array.from({ length: 30 }, (_, i) => Math.round(base * 0.62 * (1 + i * 0.01) * (0.95 + rnd() * 0.1)));
  return { users, history };
}

function insightsFor(salt) {
  const rnd = seeded(salt);
  const picks = [...GLITCH_INSIGHTS].sort(() => rnd() - 0.5).slice(0, 3);
  return picks.map((i, n) => ({ ...i, id: uid(), at: Date.now() - i.ago - n * 3600000, ago: undefined }));
}

function missionsFor(salt, count, kind) {
  const rnd = seeded(salt);
  const pool = MISSION_POOL.filter((m) => !m.kinds || m.kinds.includes(kind));
  return [...pool].sort(() => rnd() - 0.5).slice(0, count).map((m) => ({ ...m, id: `${m.id}-${uid().slice(0, 4)}`, lane: "manager", progress: Math.min(96, Math.round(m.progress * (0.6 + rnd() * 0.7))) }));
}

function nextTask(p, lane) {
  const running = new Set(p.missions.map((m) => m.title));
  if (lane === "manager") {
    const pool = MISSION_POOL.filter((m) => (!m.kinds || m.kinds.includes(p.kind)) && !running.has(m.title));
    if (!pool.length) return null;
    const m = pool[Math.floor(Math.random() * pool.length)];
    return { ...m, id: `${m.id}-${uid().slice(0, 4)}`, lane, progress: 0 };
  }
  const pool = [...(QUICK_POOL[p.kind] || []), ...QUICK_POOL.common].filter((t) => !running.has(t));
  if (!pool.length) return null;
  const title = pool[Math.floor(Math.random() * pool.length)];
  return { id: `q-${uid().slice(0, 6)}`, lane, title, site: "", url: "", icon: "check-check", progress: 0, steps: QUICK_STEPS };
}

// tops each lane up to its number running; returns what it started. With
// spread, what starts is already part-way along (the first fill)
export function fillLanes(p, rnd = Math.random, { spread = false } = {}) {
  p.laneCount ||= laneTargets(rnd);
  const started = [];
  for (const lane of LANES) {
    while (p.missions.filter((m) => m.lane === lane).length < p.laneCount[lane]) {
      const m = nextTask(p, lane);
      if (!m) break;
      if (spread) m.progress = Math.floor(rnd() * 70);
      p.missions.push(m);
      started.push(m);
    }
  }
  return started;
}

// a finished task leaves the card and the lane fills back up
export function retireTask(id, missionId) {
  const p = project(id);
  if (!p) return;
  const m = p.missions.find((x) => x.id === missionId);
  if (!m) return;
  p.missions = p.missions.filter((x) => x !== m);
  emit("mission:gone", { project: p, mission: m });
  // now and then the lane's number running changes with the work: one
  // fewer picks up, or one more
  if (Math.random() < 0.25) p.laneCount[m.lane] = laneTargets()[m.lane];
  for (const next of fillLanes(p)) emit("mission:new", { project: p, mission: next });
}

// which lane the Tasks card shows
export const railLane = () => state.rail?.lane || "manager";
export function setRailLane(lane) {
  state.rail = { ...(state.rail || {}), lane };
  emit("rail:lane", { lane });
}

// how a finished task reads on the card before it leaves (log.js DONE_FX)
export const doneEffect = () => state.rail?.done || "check";
export function setDoneEffect(done) {
  state.rail = { ...(state.rail || {}), done };
  emit("rail:done", { done });
}

// the numbers a kind's tiles carry, seeded from the project's size: the
// revenue and ad spend come from the project itself, the rest from the
// tile's share of revenue (money, num) or its base (pct)
function statsFor(p, kind, rnd) {
  const stats = {};
  for (const t of kindOf(kind).tiles) {
    if (t.id === "revenue" || t.id === "adSpend") continue;
    stats[t.id] = t.format === "pct" ? t.base : Math.round(p.revenue * (t.share ?? 0) * (0.9 + rnd() * 0.2));
  }
  return stats;
}

// the thread a project already has when you first open it: a few finished
// turns of its own kind of work spaced over the last hours, and, where the
// tile wears an orange count, the question it is waiting on
function threadFor(kind, salt, needs, count = 3) {
  const rnd = seeded(salt);
  const pool = [...kindOf(kind).work].sort(() => rnd() - 0.5).slice(0, count);
  const out = [];
  pool.forEach((step, n) => {
    const at = Date.now() - (count - n) * 50 * 60000 - Math.round(rnd() * 20 * 60000);
    out.push({ kind: "thought", text: step.thought, seconds: Math.round((0.8 + rnd() * 1.6) * 10) / 10, at });
    step.tools.forEach((t, k) => out.push({ kind: "tool", name: t.name, icon: t.icon, args: t.args, result: t.result, at: at + 1500 + k * 1200 }));
    out.push({ kind: "assistant", text: step.say, at: at + 1500 + step.tools.length * 1200 + 900 });
  });
  return out;
}

function seedProject(p, i) {
  const salt = 1000 + i * 7919;
  const series = p.id === "glitch" ? { users: GLITCH_USERS, history: Array.from({ length: 30 }, (_, k) => 540 + k * 9 + (((k * 37) % 23) - 11)) } : usersFor(p.revenue, salt);
  const rnd = seeded(salt + 1);
  const baseline = p.baseline ?? Math.round(p.revenue / (1.03 + rnd() * 0.15));
  const adSpend = p.adSpend ?? Math.round(p.revenue * (0.08 + rnd() * 0.08));
  const insights = p.id === "glitch" ? GLITCH_INSIGHTS.map((x) => ({ ...x, id: uid(), at: Date.now() - x.ago, ago: undefined })) : insightsFor(salt + 2);
  const activity = [
    { id: uid(), kind: "work", text: p.thoughts[1], at: Date.now() - 40 * 60000 },
    ...insights.slice(0, 2).map((x) => ({ id: uid(), kind: "insight", text: x.title, delta: x.delta, at: x.at })),
    { id: uid(), kind: "sale", text: `Sale added, ${formatMoneyPlain(120 + Math.round(rnd() * 500))}`, at: Date.now() - 5 * 3600000 },
    { id: uid(), kind: "setup", text: "Setup complete", at: Date.now() - (i + 3) * 86400000 * 4 + 3600000 },
  ].sort((a, b) => b.at - a.at);
  const kind = KINDS[p.kind] ? p.kind : "saas";
  // a few of the kind's own events, so its Updates tabs have rows from
  // the start: one from each event kind, then a second of the first
  const events = KINDS[kind].events || [];
  for (const [k, event] of [...events, events[0]].filter(Boolean).slice(0, 3).entries()) {
    activity.push({ id: uid(), kind: event.kind, text: eventText(event.texts[(k + i) % event.texts.length], rnd), at: Date.now() - (k + 1) * 53 * 60000 - i * 60000 });
  }
  // a project still in setup has said nothing yet and done nothing yet
  const ready = !p.setup || p.setup.complete;
  const thread = ready ? threadFor(kind, salt + 5, SEED_NEEDS[p.id]) : [];
  if (!ready) activity.length = 0;
  for (const t of thread) {
    if (t.kind === "assistant") activity.push({ id: uid(), kind: "work", text: t.text, at: t.at });
    if (t.kind === "ask") activity.push({ id: uid(), kind: "needs", text: t.question, at: t.at });
  }
  activity.sort((a, b) => b.at - a.at);
  return {
    id: p.id,
    name: p.name,
    kind,
    template: kind,
    stats: statsFor(p, kind, rnd),
    goal: "",
    createdAt: Date.now() - (i + 3) * 86400000 * 4,
    openedAt: Date.now() - i * 3600000 * 5,
    revenue: p.revenue,
    baseline,
    adSpend,
    adSpendLast: p.adSpendLast ?? Math.round(adSpend * (0.85 + rnd() * 0.25)),
    users: series.users,
    history: series.history,
    thoughts: p.thoughts,
    step: 0,
    unread: ready ? SEED_UNREAD[p.id] || 0 : 0,
    needs: 0,
    state: null,
    setup: p.setup ?? { done: ["youtube", "card", "stripe"], summary: { youtube: "Channel verified", card: "Visa ending 4242", stripe: "Stripe, ada@lovelace.co, United States" }, current: -1, complete: true },
    insights,
    activity,
    nextInsight: i % 5,
    missions: missionsFor(salt + 3, 2 + (i % 2), kind),
    thread,
    model: "Sonnet 5",
  };
}

// hoisted: seed() runs at module load, before any const below it exists
function formatMoneyPlain(n) {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function seed() {
  return {
    version: 6,
    currentId: null,
    side: { open: true },
    user: { name: "Ada Lovelace", email: "ada@lovelace.co", sessions: [{ id: "mac", device: "This Mac", where: "Ubud, Bali", last: "Now" }, { id: "phone", device: "iPhone", where: "Ubud, Bali", last: "2 hours ago" }] },
    theme: "system",
    textEffect: "fade-letters",
    model: "Sonnet 5",
    credits: { balance: 100000000, lastPack: 50000, spentToday: 0, pack: "mid", topUp: false, day: today() },
    notify: { bell: true, email: false, needs: true, insights: true, missions: true, sales: true, system: true, quiet: "off" },
    billing: { card: { brand: "Visa", last4: "4242", exp: "07 / 30", holder: "Ada Lovelace" }, invoices: SEED_INVOICES.map((i) => ({ ...i, at: Date.now() - i.ago, ago: undefined })) },
    notifications: SEED_NOTIFICATIONS.map((n) => ({ ...n, id: uid(), at: Date.now() - n.ago, ago: undefined })),
    projects: SEED_PROJECTS.map(seedProject),
  };
}

export function resetAll() {
  state = seed();
  save();
  // the server's saved log is demo data too, or the rows it held would
  // fold right back in on the next live load
  import("./live.js").then(({ notificationLive }) => notificationLive("clear", {})).catch(() => {});
  emit("reset");
}

// ---------- projects ----------

export const projects = () => state.projects;
export const project = (id) => state.projects.find((p) => p.id === id);
export const setupSteps = ["youtube", "card", "stripe"];
export const isRunning = (p) => Boolean(p.setup.complete);
// connectors still to be solved: actions the verifier can check that nobody
// has connected yet. Dismissing the popup hides it; the count stays until done
// the probes the composer can actually dock a popup for: the rail's badge
// reads this, so a count can never appear without its prompt behind it
export const CONNECTABLE_PROBES = new Set(["stripe_connect", "youtube_session"]);
export const connectorsPending = (p) => (p.thread || []).filter((t) => t.kind === "action" && !t.done && t.probe && (t.url || CONNECTABLE_PROBES.has(t.probe))).length;
// paused: YOU paused it and it holds between steps until you resume; the
// agent never pauses itself. Active is running and not paused
export const isPaused = (p) => Boolean(p.paused);
export const isActive = (p) => isRunning(p) && !p.paused;
export function setPaused(id, on) {
  const p = project(id);
  if (!p || Boolean(p.paused) === on) return;
  p.paused = on;
  pushActivity(id, "setup", on ? "Work paused" : "Work resumed");
  emit("pause", { id, paused: on });
  emit("projects", { changed: id });
  // live mode: the server's loop holds at its next boundary and the flag
  // lands in its snapshot, so every surface agrees pause is pause
  import("./live.js").then(({ pauseLive }) => pauseLive(id, on)).catch(() => {});
}

// draft: the one "new chat" that is not a project yet. It stays out of the
// rail and the grid until its first message claims it (claimDraft)
export function createProject({ name, goal = "", template = "channel", draft = false }) {
  const clean = name.trim() || "New project";
  const n = state.projects.filter((p) => p.name.startsWith(clean)).length;
  const kind = TEMPLATES.some((t) => t.id === template) ? template : "channel";
  const p = {
    id: `${clean.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project"}-${uid().slice(0, 4)}`,
    // a draft is always plain "New Project"; only a real project made with
    // a name that exists gets a number
    name: n && !draft ? `${clean} ${n + 1}` : clean,
    kind,
    template: kind,
    stats: Object.fromEntries(kindOf(kind).tiles.filter((t) => t.id !== "revenue" && t.id !== "adSpend").map((t) => [t.id, t.format === "pct" ? t.base : 0])),
    goal,
    createdAt: Date.now(),
    openedAt: Date.now(),
    revenue: 0,
    baseline: 0,
    adSpend: 0,
    adSpendLast: 0,
    users: Array.from({ length: 14 }, () => 0),
    history: Array.from({ length: 30 }, () => 0),
    thoughts: NEW_THOUGHTS,
    step: 0,
    unread: 0,
    needs: 0,
    state: null,
    setup: { done: [], summary: {}, current: 0, complete: false },
    insights: [],
    activity: [{ id: uid(), kind: "setup", text: "Project created", at: Date.now() }],
    nextInsight: 0,
    missions: [],
    thread: [],
    model: state.model,
    draft,
  };
  state.projects.unshift(p);
  state.side.order = [p.id, ...(state.side.order || []).filter((x) => x !== p.id)];
  emit("projects", { added: p.id });
  return p;
}

export function renameProject(id, name) {
  const p = project(id);
  if (!p || !name.trim()) return;
  p.name = name.trim();
  emit("projects", { renamed: id });
}

// the projects that show in the rail and the grid: everything but the draft
export const listed = () => state.projects.filter((p) => !p.draft);

// a title from the first message: its first clause, a few words at most
export function titleFrom(text) {
  const clause = text.trim().split(/[.!?\n]/)[0].replace(/^(please|can you|could you|i want to|i want|let's|lets|make|build|start|create)\s+/i, "");
  const words = clause.split(/\s+/).filter(Boolean).slice(0, 5).join(" ").replace(/[,;:]+$/, "");
  const title = words.length > 40 ? `${words.slice(0, 40).trim()}…` : words;
  return title ? title.charAt(0).toUpperCase() + title.slice(1) : "New project";
}

// the first message makes the draft a project: it gets a name from the
// message, keeps the message as its brief, and takes its place in the rail
export function claimDraft(id, text) {
  const p = project(id);
  if (!p || !p.draft) return;
  p.draft = false;
  p.name = titleFrom(text);
  p.goal = p.goal || text.trim();
  p.createdAt = Date.now();
  emit("projects", { claimed: id, renamed: id });
}

export function deleteProject(id) {
  const i = state.projects.findIndex((p) => p.id === id);
  if (i < 0) return;
  state.projects.splice(i, 1);
  state.notifications = state.notifications.filter((n) => n.projectId !== id);
  emit("projects", { removed: id });
}

export function openProject(id) {
  const p = project(id);
  if (!p) return;
  state.currentId = id;
  p.openedAt = Date.now();
  p.unread = 0;
  p.needs = 0;
  emit("project:badges", p);
}

export const currentId = () => state.currentId;

export function setSide(patch) {
  Object.assign(state.side, patch);
  emit("side");
}

// how the right rail is arranged (project.js LAYOUTS): classic until picked
// the rail's arrangement: Tasks and updates first, whatever an older state
// stored while the picker was still in the menu (setRailLayout stays for
// a picker to come back to)
// a run that wants another arrangement (the demo puts the analytics first)
// sets it for its own stay; never persisted
let railOverride = null;
export const railLayout = () => railOverride || "split-first";
export function setRailOverride(layout) {
  if (railOverride === layout) return;
  railOverride = layout;
  emit("rail", { layout: railLayout() });
}
export function setRailLayout(layout) {
  state.rail = { ...(state.rail || {}), layout };
  emit("rail", { layout });
}

export const isBusy = (id) => busy.has(id);
// the busy mark is what the agent is DOING; a paused project is held, not
// thinking, so its rows read idle even though the mission is still open
export const busyBy = (id) => (project(id)?.paused ? null : busy.get(id));
export function setBusy(id, who) {
  if (who) busy.set(id, who);
  else busy.delete(id);
  emit("busy", { id, who });
}

// the project's own log, at the right of its chat: what the agent did,
// what it found, what it sold, what it asked
export function pushActivity(id, kind, text, extra = {}) {
  const p = project(id);
  if (!p) return null;
  const item = { id: uid(), kind, text, at: Date.now(), ...extra };
  p.activity.unshift(item);
  while (p.activity.length > 80) p.activity.pop();
  emit("activity", { id, item });
  return item;
}

export function setSetupCurrent(id, current) {
  const p = project(id);
  p.setup.current = current;
  emit("setup", p);
}

// a step lands with its summary and the answers behind it, so it can be
// opened again later with what was entered still in place
export function setupStepDone(id, stepId, summary, answers = {}) {
  const p = project(id);
  if (!p.setup.done.includes(stepId)) p.setup.done.push(stepId);
  p.setup.summary[stepId] = summary;
  p.setup.answers = { ...(p.setup.answers || {}), [stepId]: answers };
  pushActivity(id, "setup", summary);
  const i = setupSteps.indexOf(stepId);
  const after = setupSteps.findIndex((s, j) => j > i && !p.setup.done.includes(s));
  p.setup.current = after >= 0 ? after : setupSteps.findIndex((s) => !p.setup.done.includes(s));
  if (stepId === "card" && !state.billing.card) state.billing.card = { brand: summary.split(" ending ")[0], last4: summary.slice(-4), exp: "", holder: state.user.name };
  emit("setup", p);
}

// what a newly set-up agent is on, once there is something to be on
const READY_THOUGHTS = ["Reading the brief and picking the first thing to do", "Setting up the first mission from the brief", "Watching the first numbers land before I change anything", "Writing down what the brief asks for, in order"];

export function completeSetup(id) {
  const p = project(id);
  p.setup.complete = true;
  if (p.thoughts[0] === NEW_THOUGHTS[0]) {
    p.thoughts = READY_THOUGHTS;
    p.step = 0;
  }
  p.missions = missionsFor(Date.now() % 100000, 2, p.kind);
  fillLanes(p);
  pushActivity(id, "setup", "Setup complete");
  emit("setup", p);
  emit("projects", { changed: id });
}

export function resetSetup(id) {
  const p = project(id);
  p.setup = { done: [], summary: {}, answers: {}, current: 0, complete: false };
  emit("setup", p);
  emit("projects", { changed: id });
}

export function pushThread(id, item, { own = false } = {}) {
  const p = project(id);
  if (!p) return null;
  const stored = { ...item, at: Date.now() };
  p.thread.push(stored);
  // kept above the server's thread cap, so nothing the backend still has
  // is dropped on arrival and scrolling up reaches the first message
  while (p.thread.length > 2500) p.thread.shift();
  emit("thread", { id, item: stored, own });
  return stored;
}

export function clearThread(id) {
  const p = project(id);
  p.thread = [];
  emit("thread:clear", { id });
}

export function setProjectGoal(id, goal) {
  const p = project(id);
  if (!p) return;
  p.goal = goal;
  emit("projects", { changed: id });
}

// the plan drafted from the first message: its steps, the changes asked
// for in the chat, and whether it has been agreed (which is when the
// setup checklist follows)
export function setPlan(id, steps) {
  const p = project(id);
  if (!p) return;
  p.plan = { steps, changes: [], agreed: false };
  emit("plan", { id });
}

export function changePlan(id, text) {
  const p = project(id);
  if (!p?.plan) return;
  p.plan.changes.push(text.trim().replace(/[.]+$/, ""));
  emit("plan", { id });
}

export function agreePlan(id) {
  const p = project(id);
  if (!p?.plan || p.plan.agreed) return;
  p.plan.agreed = true;
  pushActivity(id, "setup", "Plan agreed");
  emit("plan", { id });
}

// how much the agent asks: Ask stops for permission before an action
// (a card in the thread, its work waiting on the answer); Yolo never asks
// Yolo is the default and leads the menu; Ask is the one you opt into
export const MODES = [
  { id: "yolo", label: "Yolo", hint: "never asks", icon: "zap" },
  { id: "ask", label: "Ask", hint: "asks before it acts", icon: "circle-help" },
];
export const projectMode = (p) => (p.mode === "ask" ? "ask" : "yolo");
export function setProjectMode(id, mode) {
  const p = project(id);
  if (!p) return;
  p.mode = mode === "ask" ? "ask" : "yolo";
  emit("mode", { id, mode: p.mode });
}

export function setProjectModel(id, model) {
  const p = project(id);
  p.model = model;
  state.model = model;
  emit("model", { id, model });
}

// ---------- credits ----------

// credits per dollar, the small pack's rate; "other" is any amount at it
export const CREDITS_PER_DOLLAR = CREDIT_PACKS[0].credits / CREDIT_PACKS[0].price;
export const packById = (id) => {
  if (id === "other") {
    const price = Math.max(0, Math.round(Number(state.credits.other) || 0));
    return { id: "other", credits: price * CREDITS_PER_DOLLAR, price };
  }
  return CREDIT_PACKS.find((p) => p.id === id) || CREDIT_PACKS[0];
};

export function spendCredit() {
  const c = state.credits;
  if (c.balance <= 0) return false;
  c.balance -= 1;
  c.spentToday += 1;
  emit("credits", { from: null });
  if (c.topUp && c.balance < CREDITS_LOW && !c.buying) addCredits(CREDIT_PACKS[0], { auto: true });
  return true;
}

// the live backend owns the account's balance (it meters the agent's
// token usage); the client renders the number it is given
export function setCreditsBalance(n) {
  const v = Math.max(0, Math.round(Number(n) || 0));
  if (state.credits.balance === v) return;
  state.credits.balance = v;
  emit("credits", { from: v });
}

export function addCredits(pack, { auto = false } = {}) {
  const c = state.credits;
  const from = c.balance;
  c.balance += pack.credits;
  c.lastPack = pack.credits;
  state.billing.invoices.unshift({ id: `INV-${String(31 + state.billing.invoices.length).padStart(4, "0")}`, at: Date.now(), amount: pack.price, desc: `${pack.credits.toLocaleString("en-US")} credits${auto ? " (top-up)" : ""}`, status: "Paid" });
  emit("credits", { from });
  emit("billing");
  pushNotification("sale", auto ? `Topped up ${pack.credits.toLocaleString("en-US")} credits` : `${pack.credits.toLocaleString("en-US")} credits added`);
}

export function setPack(id) {
  state.credits.pack = id;
  emit("credits:pack");
}

export function setTopUp(on) {
  state.credits.topUp = on;
  emit("credits:topup");
}

export function setBuying(on) {
  state.credits.buying = on;
}

// the typed dollar amount behind the "other" pack
export function setOther(amount) {
  state.credits.other = Math.max(0, Math.round(Number(amount) || 0));
  emit("credits:other");
}

// ---------- notifications ----------

export function pushNotification(kind, text, { projectId = null } = {}) {
  if (state.notify[kind === "model" || kind === "upload" ? "system" : kind === "insight" ? "insights" : kind === "sale" ? "sales" : kind] === false) return null;
  const n = { id: uid(), kind, text, at: Date.now(), read: false, projectId };
  pushStored(n);
  // live mode: the server keeps the bell's log, so a fresh load finds
  // these rows again instead of falling back to the seed
  import("./live.js").then(({ notificationLive }) => notificationLive("push", n)).catch(() => {});
  return n;
}

// insert a notification built elsewhere — an SSE event from the server or
// a merge of its saved log: no preference check, no round trip of its own
export function pushStored(n) {
  if (!n?.id || state.notifications.some((x) => x.id === n.id)) return null;
  state.notifications.unshift(n);
  while (state.notifications.length > 200) state.notifications.pop();
  emit("notification", n);
  return n;
}

// the server's saved log folds into the store newest-first; rows already
// held keep their own read flag
export function mergeNotifications(list) {
  for (const n of [...(list || [])].reverse()) pushStored(n);
}

// server echoes of a read or a clear land here, so every open session's
// bell agrees; no repost — the server is already the source of truth
export function applyNotificationsRead({ ids = [], all = false } = {}) {
  let changed = false;
  for (const n of state.notifications) {
    if ((all || ids.includes(n.id)) && !n.read) {
      n.read = true;
      changed = true;
    }
  }
  if (changed) emit("notifications:read");
}

export function applyNotificationsClear() {
  if (!state.notifications.length) return;
  state.notifications = [];
  emit("notifications:read");
}

export const unreadCount = () => state.notifications.filter((n) => !n.read).length;

export function markRead(id) {
  const n = state.notifications.find((x) => x.id === id);
  if (!n || n.read) return;
  n.read = true;
  emit("notifications:read");
  import("./live.js").then(({ notificationLive }) => notificationLive("read", { id })).catch(() => {});
}

export function markAllRead() {
  for (const n of state.notifications) n.read = true;
  emit("notifications:read");
  import("./live.js").then(({ notificationLive }) => notificationLive("read_all", {})).catch(() => {});
}

export function clearNotifications() {
  state.notifications = [];
  emit("notifications:read");
  import("./live.js").then(({ notificationLive }) => notificationLive("clear", {})).catch(() => {});
}

// ---------- settings ----------

export function setTheme(theme) {
  state.theme = theme;
  emit("theme", theme);
}

export function setTextEffect(id) {
  state.textEffect = id;
  emit("textEffect", id);
}

export function setUser(patch) {
  Object.assign(state.user, patch);
  emit("user");
}

export function endSession(id) {
  state.user.sessions = state.user.sessions.filter((s) => s.id !== id);
  emit("user");
}

export function setNotify(kind, value) {
  state.notify[kind] = value;
  emit("notify");
}

export function setCard(card) {
  state.billing.card = card;
  emit("billing");
}
