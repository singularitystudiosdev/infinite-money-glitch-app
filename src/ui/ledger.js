// ledger.js: the project rail's Ledger card (P10 SCOPE 4) — the mission's work
// as the swarm partitions it. One row per item: what it is, whether it is
// ready, waiting on something, in flight, landed or blocked, the paths it owns,
// the items it waits on, and the files its receipt actually names. An open item
// can be cancelled from here, which takes it out of the next round.
//
// The card is DATA-DRIVEN off p.ledger, which the server emits whole on every
// mutation (server/swarm.js, the `ledger` event), so the page never computes
// readiness itself: it draws what the server decided.
import { icon } from "../icons.js";
import { project, subscribe } from "../store.js";
import { cancelLedgerItem } from "../live.js";
import { escapeHtml } from "../util.js";

// status -> mark and word. "ready" is a derived property (nothing waits on it),
// not a status the item is written with.
const STATUS = {
  pending: { icon: "inbox", word: "queued" },
  dispatched: { icon: "loader-circle", word: "running", spin: true },
  reported: { icon: "eye", word: "judging" },
  completed: { icon: "check", word: "done" },
  blocked: { icon: "circle-alert", word: "blocked" },
  cancelled: { icon: "x", word: "dropped" },
};
const OPEN = new Set(["pending", "dispatched", "reported", "blocked"]);

const paths = (list = []) => list.join(", ");

// one item's row. Everything a gate or a person asks about an item is on the
// row as data (status, owns, deps, receipt) as well as drawn, so the page's
// claim and the server's record can be compared without reading pixels.
const itemRow = (it) => {
  const st = STATUS[it.status] || STATUS.pending;
  const ready = Boolean(it.ready);
  const receipts = (it.receipt?.files || []).map((f) => `${f.path}${f.attributed === false ? " (?)" : ""}`);
  const cost = it.cost && (it.cost.calls || it.cost.usd) ? `$${(Number(it.cost.usd) || 0).toFixed(4)} · ${it.cost.calls} call${it.cost.calls === 1 ? "" : "s"}` : "";
  return `<li class="app-ledger__row is-${it.status}" role="listitem" data-item="${escapeHtml(it.id)}" data-status="${escapeHtml(it.status)}" data-ready="${ready}" data-owns="${escapeHtml(paths(it.owns))}" data-deps="${escapeHtml(paths(it.deps))}" data-receipt="${escapeHtml(paths(receipts))}">
  <span class="app-ledger__mark">${icon(st.icon, st.spin ? "app-ledger__spin" : "")}</span>
  <span class="app-ledger__body">
    <span class="app-ledger__top">
      <span class="app-ledger__id">${escapeHtml(it.id)}</span>
      <span class="app-ledger__title">${escapeHtml(it.content)}</span>
      <span class="app-ledger__status">${escapeHtml(ready ? "ready" : st.word)}</span>
    </span>
    ${it.owns?.length ? `<span class="app-ledger__line">${icon("file-text")}<span>owns ${escapeHtml(paths(it.owns))}</span></span>` : ""}
    ${it.deps?.length ? `<span class="app-ledger__line">${icon("arrow-left")}<span>waits on ${escapeHtml(paths(it.deps))}</span></span>` : ""}
    ${receipts.length ? `<span class="app-ledger__line is-receipt">${icon("check-check")}<span>${escapeHtml(paths(receipts))}</span></span>` : ""}
    ${it.blockReason ? `<span class="app-ledger__line is-block">${icon("circle-alert")}<span>${escapeHtml(it.blockReason)}</span></span>` : ""}
    ${it.cancelReason ? `<span class="app-ledger__line is-drop">${icon("x")}<span>${escapeHtml(it.cancelReason)}</span></span>` : ""}
    ${cost ? `<span class="app-ledger__line is-cost">${icon("coins")}<span>${escapeHtml(cost)}</span></span>` : ""}
    <span class="app-ledger__meta">${escapeHtml(it.kind)}${it.attempts ? ` · ${it.attempts} attempt${it.attempts === 1 ? "" : "s"}` : ""}${it.supersedes ? ` · replaces ${escapeHtml(it.supersedes)}` : ""}</span>
  </span>
  ${OPEN.has(it.status) ? `<button type="button" class="btn btn--icon btn--quiet app-ledger__x" data-ledger-cancel="${escapeHtml(it.id)}" aria-label="Cancel ${escapeHtml(it.id)}">${icon("x")}</button>` : ""}
</li>`;
};

export function renderLedger(root, projectId) {
  const p = () => project(projectId);
  root.innerHTML = `<section class="panel app-ledger" aria-label="Ledger">
  <div class="app-ledger__head"><span class="c-dash__heading"><span class="c-dash__title">Ledger</span><span class="c-dash__meta" data-ledger-count></span></span></div>
  <ul class="app-ledger__list" data-ledger-list role="list"></ul>
  <div class="app-ledger__none" data-ledger-none hidden><span class="app-ledger__none-title">No ledger yet</span><span class="app-ledger__none-sub">Work the swarm partitions lands here</span></div>
</section>`;

  function paint() {
    const ledger = p()?.ledger;
    const items = Array.isArray(ledger?.items) ? ledger.items : [];
    const ready = items.filter((i) => i.ready).length;
    const open = items.filter((i) => OPEN.has(i.status)).length;
    root.querySelector("[data-ledger-list]").innerHTML = items.map(itemRow).join("");
    root.querySelector("[data-ledger-none]").hidden = items.length > 0;
    root.querySelector("[data-ledger-count]").textContent = items.length ? `${items.length} items · ${ready} ready${open ? ` · ${open} open` : ""}` : "";
  }

  root.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-ledger-cancel]");
    if (!btn) return;
    btn.disabled = true;
    const res = await cancelLedgerItem(projectId, btn.dataset.ledgerCancel);
    btn.disabled = false;
    if (!res?.ok) btn.title = res?.error || "Could not cancel this item.";
  });

  const off = subscribe((topic, payload) => {
    if (!root.isConnected) {
      off();
      return;
    }
    if (topic === "ledger" && payload.id === projectId) paint();
    else if (topic === "projects" && payload.changed === projectId) paint();
  });
  paint();
  return () => off();
}