// live.js — the connector to the real agent backend. When /health answers,
// the frontend runs on it: threads, plans, setup, tools and the daemon all
// come from SSE events; sending posts /api/turn. When it does not answer,
// every caller falls back to the scripted sim (sim.js path).
import { deleteProject, project, pushThread, pushActivity, setBusy, setCreditsBalance, setPlan, agreePlan, pushStored, mergeNotifications, applyNotificationsRead, applyNotificationsClear, reconcileServerProjects, setBillingRemote, emit } from "./store.js";

let es = null;
let connected = false;
let daemon = { running: false, ticks: 0, findings: [] };
const listeners = { live: [], daemon: [] };

export const liveConnected = () => connected;
export const liveDaemon = () => daemon;
export function onLive(fn) {
  listeners.live.push(fn);
  return () => { const i = listeners.live.indexOf(fn); if (i >= 0) listeners.live.splice(i, 1); };
}
export function onDaemon(fn) {
  listeners.daemon.push(fn);
  return () => { const i = listeners.daemon.indexOf(fn); if (i >= 0) listeners.daemon.splice(i, 1); };
}

export async function initLive() {
  try {
    const r = await fetch("/health", { signal: AbortSignal.timeout(2500) });
    if (!r.ok) return false;
  } catch {
    return false;
  }
  connected = true;
  for (const fn of [...listeners.live]) fn(true);
  try {
    const snap = await (await fetch("/api/state")).json();
    if (snap.daemon) daemon = snap.daemon;
    if (Number.isFinite(snap.account?.credits)) setCreditsBalance(snap.account.credits);
    for (const sp of snap.projects || []) upsertProject(sp);
    reconcileServerProjects((snap.projects || []).map((sp) => sp.id));
    if (Array.isArray(snap.notifications)) mergeNotifications(snap.notifications);
    // even with no server projects, every surface now knows it is live
    // (the rail drops the seeded samples the moment this lands)
    emit("projects", {});
    fireDaemon();
  } catch {
    // the SSE hello carries the same state
  }
  openStream();
  return true;
}

function openStream() {
  es = new EventSource("/api/events");
  es.onmessage = (m) => {
    let evt;
    try {
      evt = JSON.parse(m.data);
    } catch {
      return;
    }
    try {
      apply(evt);
    } catch (err) {
      console.error("live event failed", evt?.t, err);
    }
  };
  es.onerror = () => {
    connected = false;
    for (const fn of [...listeners.live]) fn(false);
    es.close();
    es = null;
    setTimeout(() => initLive(), 4000);
  };
}

// projects deleted this session: their in-flight missions still emit
// upserts, and a deleted chat must not come back from the dead
const removed = new Set();

// map a server project object onto the store's shape, additively
function upsertProject(sp) {
  if (removed.has(sp.id)) return;
  const existing = project(sp.id);
  // what the rail drew before this word arrived, so the mission rows can be
  // told what actually moved
  const before = existing ? (existing.missions || []) : [];
  const beforePaused = existing ? Boolean(existing.paused) : undefined;
  if (existing) {
    Object.assign(existing, sp);
    // a claimed draft lives in the store under the same id; the first
    // server word on it makes it a real chat for the rail's filter
    existing.server = true;
    existing.draft = false;
  }
  else import("./store.js").then(({ addServerProject }) => addServerProject(sp));
  emit("projects", { changed: sp.id });
  // the async addServerProject may not have landed yet; a missing project
  // must not throw the whole stream handler
  const pp = project(sp.id);
  if (!pp) return;
  emit("setup", { id: sp.id, setup: pp.setup });
  // The missions card repaints off the MISSION topic, not off "projects": a
  // press on the row, the bar, the step line and the "N running" header all
  // hang off it (src/ui/log.js:216). The server sends whole projects, so the
  // rows would sit frozen at the number the page first drew without this.
  for (const m of sp.missions || []) {
    const prev = before.find((b) => b && b.id === m.id);
    if (!prev || prev.progress !== m.progress || prev.status !== m.status || prev.phase !== m.phase || prev.rowStatus !== m.rowStatus) emit("mission", { project: pp, mission: m });
  }
  if (beforePaused !== undefined && beforePaused !== Boolean(pp.paused)) emit("pause", { id: sp.id, paused: pp.paused });
}

function apply(evt) {
  const id = evt.projectId;
  switch (evt.t) {
    case "hello": {
      if (evt.daemon) daemon = evt.daemon;
      if (Number.isFinite(evt.account?.credits)) setCreditsBalance(evt.account.credits);
      if (evt.account?.billing) setBillingRemote(evt.account.billing);
      // a reconnect takes the server's word for what exists
      removed.clear();
      for (const sp of evt.projects || []) upsertProject(sp);
      if (Array.isArray(evt.notifications)) mergeNotifications(evt.notifications);
      fireDaemon();
      break;
    }
    case "project_upsert":
      upsertProject(evt.project);
      break;
    case "project_delete": {
      removed.add(id);
      deleteProject(id);
      break;
    }
    case "account": {
      if (Number.isFinite(evt.account?.credits)) setCreditsBalance(evt.account.credits);
      // the plan, the caps, the top-up preference and the card ride the account
      // event: billing has no event type of its own (the list is pinned at 17)
      if (evt.account?.billing) setBillingRemote(evt.account.billing);
      break;
    }
    case "thread": {
      const p = project(id);
      if (!p) break;
      const it = evt.item;
      // the same item can arrive again mutated (an auth ask retired by the
      // verifier): update in place by id, push only what is truly new. A
      // matched USER bubble was already drawn optimistically at send time, so
      // its echo re-enters flagged own: the view skips it and one send stays
      // one bubble. Server-mutated items (actions, asks) still re-enter
      // unflagged so their surfaces repaint.
      const own = (p.thread || []).find((t) => t.id === it.id);
      if (own) {
        const wasOwnUser = own.kind === "user"; // captured before the merge: a reply echo can flip the kind
        Object.assign(own, it);
        emit("thread", { id, item: own, own: wasOwnUser });
      }
      else {
        const dup = [...p.thread].reverse().find((t) => t.kind === it.kind && t.text === it.text && Date.now() - (t.at || 0) < 20000);
        if (!dup) pushThread(id, it);
      }
      emit();
      break;
    }
    case "subagent_thought": {
      const p = project(id);
      if (!p) break;
      const row = (p.subagents || []).find((s) => s.id === evt.id);
      if (!row) break;
      row.thought = evt.thought;
      row.thoughts = evt.thoughts || [evt.thought];
      emit("projects", { changed: id });
      break;
    }
    case "status": {
      const p = project(id);
      if (!p) break;
      p.liveStatus = evt.status || null;
      setBusy(id, evt.status ? "agent" : null);
      emit("live:status", { id, text: evt.status });
      break;
    }
    case "activity": {
      const e = evt.entry || {};
      // the WHOLE entry rides through: an insight's delta is what its pill
      // draws (log.js:67), and dropping it here is what left live mode with no
      // deltas at all. The server's id and time are kept too, so the same row
      // arriving twice updates in place rather than doubling.
      pushActivity(id, e.kind || "work", e.text, { ...e, kind: e.kind || "work", text: e.text });
      break;
    }
    case "plan": {
      const p = project(id);
      if (!p || !evt.plan) break;
      if (!p.plan) setPlan(id, evt.plan.steps || []);
      else {
        p.plan.steps = evt.plan.steps || p.plan.steps;
        p.plan.changes = evt.plan.changes || p.plan.changes;
      }
      if (evt.plan.agreed && !p.plan.agreed) agreePlan(id);
      emit("plan:updated", { id });
      break;
    }
    case "setup": {
      const p = project(id);
      if (!p) break;
      p.setup = { ...p.setup, ...evt.setup };
      emit("setup", { id, setup: p.setup });
      break;
    }
    // the mission's plan tree, as the server works it: one item per worker with
    // owns/reads/deps, its status and the receipt it landed. It arrives whole on
    // every mutation, so the store always holds the ledger the server is running
    case "ledger": {
      const p = project(id);
      if (!p) break;
      p.ledger = evt.ledger;
      emit("ledger", { id, ledger: evt.ledger });
      break;
    }
    case "stats": {
      const p = project(id);
      if (!p) break;
      const tiles = new Set();
      const stats = evt.stats || {};
      // the rail's own descriptor for each key that moved (label + format), so
      // a project whose KPIs were never predicted still draws the connector's
      // number under the connector's label
      if (Array.isArray(evt.tiles)) {
        p.metricTiles = { ...(p.metricTiles || {}) };
        for (const t of evt.tiles) p.metricTiles[t.id] = t;
      }
      // only the keys that moved arrive, and every one of them is a live tile
      for (const [k, v] of Object.entries(stats)) {
        p.stats[k] = v;
        tiles.add(k);
        // the P1 contract's spelling: a payload of {stats:{revenue:N}} IS the
        // project's revenue, and test/contract/events.test.mjs drives exactly
        // that shape. P7's poller also sends a top-level `revenue`; both work.
        if (k === "revenue" && v != null) p.revenue = v;
      }
      // the KPI counters the goal's tiles are valued from (running.js:55-56)
      if (evt.kpi && typeof evt.kpi === "object") {
        p.counters = { ...(p.counters || {}), kpi: { ...((p.counters || {}).kpi || {}), ...evt.kpi } };
        for (const k of Object.keys(evt.kpi)) tiles.add(k);
      }
      // the series the graph draws, when it rode along: 14 days and the 30 before
      if (Array.isArray(evt.users)) p.users = evt.users;
      if (Array.isArray(evt.history)) p.history = evt.history;
      if (Number.isFinite(evt.revenue)) p.revenue = evt.revenue;
      if (Number.isFinite(evt.baseline)) p.baseline = evt.baseline;
      const revenue = Number.isFinite(evt.revenue) ? evt.revenue : Number(stats.revenue);
      if (Number.isFinite(revenue) && !Array.isArray(evt.history)) {
        // no series came with this one: keep the old derivation so the
        // revenue pill still moves on a single number
        p.history = [...(p.history || []).slice(1), Math.max(0, revenue - (p.baseline || 0))];
      }
      const tile = evt.tile && tiles.has(evt.tile) ? evt.tile : [...tiles].at(-1) || null;
      emit("projects", { changed: id });
      if (tile) emit("stats", { project: p, tile });
      if (Array.isArray(evt.users)) emit("users", { id });
      break;
    }
    // the bell's log, kept by the server: a push from any session (our own
    // comes back deduped by id), and the read/clear echoes that follow it
    case "notification":
      if (evt.item) pushStored(evt.item);
      break;
    case "notifications:read":
      applyNotificationsRead({ ids: evt.ids || [], all: Boolean(evt.all) });
      break;
    case "notifications:clear":
      applyNotificationsClear();
      break;
    case "daemon_tick":
      daemon = { ...daemon, running: true, ticks: evt.n, lastTick: Date.now(), said: evt.said || [], fixes: evt.fixes || [], coverage: evt.coverage };
      fireDaemon();
      break;
    case "log":
      if (evt.level === "error") console.error("[server]", evt.text);
      break;
    default:
      break;
  }
}

function fireDaemon() {
  for (const fn of [...listeners.daemon]) fn(daemon);
}

// ---- outbound ----

// the bell's log lives server-side in live mode: push a row, or echo a
// read/clear. Fire-and-forget — the store already holds the entry, and the
// server's SSE broadcast (our own push comes back, deduped by id) keeps
// the other sessions in step
export async function notificationLive(action, payload = {}) {
  if (!connected) return;
  try {
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...payload }),
    });
  } catch {
    // the entry stays local; the next action will try again
  }
}

export async function sendLive(projectId, text, snapshot, msgId) {
  try {
    const r = await fetch("/api/turn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, text, project: snapshot, msgId }),
    });
    const j = await r.json().catch(() => ({}));
    // the mission id rides back so the composer can tell a job (the server
    // clears busy when it ends) from a conversation (the answer landing does)
    return { ok: r.ok, handled: j.handled || null, missionId: j.missionId || null };
  } catch {
    return { ok: false, handled: null };
  }
}

export async function planLive(projectId, action, text) {
  try {
    await fetch("/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, action, text }),
    });
  } catch {
    // the sim still owns this project's plan
  }
}

export async function setupLive(projectId, action, step, summary) {
  try {
    await fetch("/api/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, action, step, summary }),
    });
  } catch {
    // setup is server-owned in live mode
  }
}

// pause is server state too: the loop holds at its next phase boundary and
// the snapshot carries the flag, so a reload reads paused as paused
export async function pauseLive(projectId, paused) {
  if (!connected) return;
  try {
    await fetch("/api/pause", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, paused }),
    });
  } catch {
    // the local flag already shows; the next turn re-syncs it
  }
}

// every POST carries the double-submit token the page can read (img_csrf):
// the server refuses a POST without it
const writeHeaders = () => ({ "Content-Type": "application/json", "x-csrf-token": document.cookie.match(/(?:^|;\s*)img_csrf=([^;]+)/)?.[1] || "" });

export async function spawnSubagents(projectId, { task, model, tools, count }) {
  try {
    const r = await fetch("/api/subagents", {
      method: "POST",
      headers: writeHeaders(),
      body: JSON.stringify({ projectId, task, model, tools, count }),
    });
    const j = await r.json();
    return r.ok ? { ok: true, count: j.count, ids: j.ids || [], queued: j.queued || [] } : { ok: false, error: j.error || `HTTP ${r.status}` };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
}

// cancel one ledger item: it leaves the ready set, so the next round does not
// pick it up (P10 SCOPE 4)
export async function cancelLedgerItem(projectId, itemId) {
  try {
    const r = await fetch("/api/ledger", { method: "POST", headers: writeHeaders(), body: JSON.stringify({ projectId, action: "cancel", itemId }) });
    const j = await r.json();
    return r.ok ? { ok: true, cancelled: j.cancelled } : { ok: false, error: j.error || `HTTP ${r.status}` };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
}

export async function fetchFile(projectId, path) {
  const r = await fetch(`/api/file?projectId=${encodeURIComponent(projectId)}&path=${encodeURIComponent(path)}`);
  if (!r.ok) throw new Error(`file ${path}: ${r.status}`);
  return (await r.json()).content;
}
