// daemon.js: the explorer's improvement daemon, at the top of the
// activity page: whether it is awake, what it said on its last tick, and
// what it fixed. Read only while the page is open; painted per tick.
import { liveDaemon, onDaemon } from "../live.js";
import { escapeHtml, riseIn } from "../util.js";

// a tick's lines arrive as plain strings; keep that contract, whatever
// else a later daemon sends
const lineOf = (x) => (typeof x === "string" ? x : x?.text || x?.message || "");

// the two lists show this many rows, latest first
const SAID_ROWS = 6;
const FIX_ROWS = 4;

// one list of the panel: its label, its rows (or its quiet line), latest first
const listMarkup = (slot, label, empty) => `<div class="app-daemon__col">
  <span class="app-daemon__label">${label}</span>
  <ul class="app-daemon__list" data-daemon-${slot} role="list"></ul>
  <p class="app-daemon__none" data-daemon-${slot}-none hidden>${empty}</p>
</div>`;

const rowMarkup = (text) => `<li class="app-daemon__row" role="listitem">${escapeHtml(text)}</li>`;

export function renderDaemon(root) {
  root.innerHTML = `<section class="panel app-daemon" aria-label="Evolution daemon">
  <div class="app-daemon__head">
    <span class="c-dash__heading"><span class="c-dash__title"><span class="app-daemon__pulse" data-daemon-pulse aria-hidden="true"></span>Evolution daemon</span><span class="c-dash__meta" data-daemon-tick>idle</span></span>
  </div>
  <p class="app-daemon__coverage" data-daemon-coverage hidden></p>
  <div class="app-daemon__cols">${listMarkup("said", "Said", "Quiet tick")}${listMarkup("fix", "Fixes", "Nothing filed")}</div>
</section>`;

  // what led each list the last time it was painted, so a fresh first row
  // is the one that animates in
  const led = { said: "", fix: "" };

  function paintList(slot, items, cap) {
    const list = root.querySelector(`[data-daemon-${slot}]`);
    const none = root.querySelector(`[data-daemon-${slot}-none]`);
    const lines = items.map(lineOf).filter(Boolean).slice(0, cap);
    none.hidden = lines.length > 0;
    list.hidden = !lines.length;
    list.innerHTML = lines.map(rowMarkup).join("");
    const first = list.firstElementChild;
    if (first && lines[0] !== led[slot]) riseIn(first, { y: 4 });
    led[slot] = lines[0] || "";
  }

  function paint(d) {
    root.querySelector("[data-daemon-pulse]").classList.toggle("is-idle", !d.running);
    root.querySelector("[data-daemon-tick]").textContent = d.running && d.ticks ? `tick ${d.ticks}` : "idle";
    const coverage = root.querySelector("[data-daemon-coverage]");
    coverage.hidden = !d.coverage;
    if (d.coverage) coverage.textContent = d.coverage;
    paintList("said", d.said || [], SAID_ROWS);
    paintList("fix", d.fixes || [], FIX_ROWS);
  }

  paint(liveDaemon());
  const offDaemon = onDaemon((d) => {
    if (!root.isConnected) return;
    paint(d);
  });
  return offDaemon;
}
