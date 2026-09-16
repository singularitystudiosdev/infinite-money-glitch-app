// util.js: the small shared pieces every page uses.
import { icon } from "./icons.js";

export const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
export const EASE_OUT = "cubic-bezier(0, 0, 0, 1)"; /* --ease-standard-decelerate */
export const EASE_STD = "cubic-bezier(0.2, 0, 0, 1)"; /* --ease-standard */

export const formatMoney = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
export const formatNum = (n) => Math.round(n).toLocaleString("en-US");
export const uid = () => Math.random().toString(36).slice(2, 9);
export const pick = (list) => list[Math.floor(Math.random() * list.length)];
export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

// a line from the pools may carry links as [label](https://…): split into
// plain runs and links, so a renderer can type them out or mark them up
const LINK = /\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g;
export function linkParts(text) {
  const parts = [];
  let last = 0;
  for (const m of String(text).matchAll(LINK)) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index) });
    parts.push({ label: m[1], url: m[2] });
    last = m.index + m[0].length;
  }
  if (last < String(text).length) parts.push({ text: String(text).slice(last) });
  return parts;
}

// a heading marker never reaches the screen: a "# Title", "## Title" or
// "##Title" line is drawn as a bold line instead. Two or more hashes may sit
// unspaced; a single one needs its space, so a ledger id like "#3 pending"
// never turns bold
export const headingsToBold = (text) => String(text ?? "").replace(/(^|\n)[ \t]*(#{2,6}[ \t]*|#[ \t]+)([^\n]*?)[ \t]*#*[ \t]*(?=\n|$)/g, (_, lead, mark, title) => `${lead}**${title.replace(/\*\*/g, "")}**`);

// the model's bold markers do not always pair (an odd count leaves one
// dangling): pairs close where they can, an unclosed opener bolds to the end
// of its line, and a stray marker never reaches the screen
const boldedLine = (line) => line
  .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
  .replace(/\*\*([^*]+)$/, "<strong>$1</strong>")
  .replace(/\*\*/g, "");

// the same text with its markers gone, for a reveal that draws it word by
// word before the finished line is drawn whole
export const plainText = (text) => headingsToBold(text).split("\n").map((line) => line.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*\*/g, "")).join("\n").replace(/`([^`\n]+)`/g, "$1");

// the same text as HTML: escaped, links as anchors, and the assistant's
// light markdown (bold, bullets, headings as bold lines) drawn instead of
// shown raw
export function richText(text) {
  return linkParts(headingsToBold(text))
    .map((p) => {
      const html = p.url
        ? `<a class="c-msg__link" href="${escapeHtml(p.url)}" target="_blank" rel="noopener">${escapeHtml(p.label)}</a>`
        : escapeHtml(p.text).split("\n").map(boldedLine).join("\n").replace(/`([^`\n]+)`/g, "<code>$1</code>");
      return html;
    })
    .join("")
    .replace(/(^|\n)[-•] /g, "$1<span class=\"c-msg__bullet\">•</span> ");
}

const DAY = 86400000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const shortDate = (ts) => {
  const d = new Date(ts);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
};

export const timeOf = (ts) => new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

// how long ago, in the words the frames use: Just now, Today, Yesterday, then the date
export function relTime(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (ts >= today.getTime()) return "Today";
  if (ts >= today.getTime() - DAY) return "Yesterday";
  return shortDate(ts);
}

export function dayLabel(ts) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (ts >= today.getTime()) return "Today";
  if (ts >= today.getTime() - DAY) return "Yesterday";
  return shortDate(ts);
}

export function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

// an ease-out tween from one number to another on any element, with any
// formatter; a newer tween on the same element cancels the one in flight
const odometerFrames = new WeakMap();
export function odometerTo(el, target, { from = 0, duration = 1200, format = formatNum } = {}) {
  cancelAnimationFrame(odometerFrames.get(el));
  const paint = (value) => {
    el.textContent = format(value);
  };
  if (reduceMotion() || from === target) return paint(target);
  const start = performance.now();
  const frame = (now) => {
    const t = Math.min(1, (now - start) / duration);
    paint(from + (target - from) * easeOutCubic(t));
    if (t < 1) odometerFrames.set(el, requestAnimationFrame(frame));
  };
  odometerFrames.set(el, requestAnimationFrame(frame));
}

export const numberIn = (el) => Number(String(el.textContent).replace(/[^0-9.-]/g, "")) || 0;

// the status line is read out by assistive tech and never shown: no toast
// pops for an action, the page itself shows what changed
let statusTimer;
export function announce(text) {
  const el = document.getElementById("status");
  if (!el) return;
  el.textContent = text;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => (el.textContent = ""), 2200);
}

export function popIn(svg) {
  if (!svg || reduceMotion()) return;
  svg.animate([{ transform: "scale(0.6)", opacity: 0 }, { transform: "scale(1.15)", opacity: 1, offset: 0.7 }, { transform: "scale(1)", opacity: 1 }], { duration: 300, easing: EASE_OUT });
}

export function riseIn(el, { duration = 200, y = 4 } = {}) {
  if (!el || reduceMotion()) return;
  el.animate([{ opacity: 0, transform: `translateY(${y}px)` }, { opacity: 1, transform: "translateY(0)" }], { duration, easing: EASE_OUT });
}

// the loading-to-done shape every action button runs: a spinner and the
// busy word, then a check and the done word, then (unless it holds) back
// to rest. Returns false when the button is already busy.
export async function runButton(button, { busy, done, rest, work = 1200, hold = 1500, keep = false } = {}) {
  if (!button || button.dataset.busy) return false;
  button.dataset.busy = "1";
  const iconSlot = button.querySelector(".btn__icon");
  const label = button.querySelector(".btn__label");
  const restLabel = rest ?? label.textContent;
  button.setAttribute("aria-busy", "true");
  iconSlot.innerHTML = icon("loader-circle", "btn__spinner");
  label.textContent = busy;
  await wait(reduceMotion() ? 300 : work);
  button.removeAttribute("aria-busy");
  iconSlot.innerHTML = icon("check");
  label.textContent = done;
  popIn(iconSlot.querySelector("svg"));
  if (keep) {
    button.setAttribute("aria-disabled", "true");
    return true;
  }
  await wait(hold);
  if (!button.isConnected) return true;
  iconSlot.innerHTML = "";
  label.textContent = restLabel;
  delete button.dataset.busy;
  return true;
}

// keyboard travel inside a menu: arrows wrap, Home and End jump
export function menuKeys(e, container, selector = "[role=menuitem], [role=menuitemradio], [role=option]") {
  const items = [...container.querySelectorAll(selector)];
  if (!items.length) return false;
  const i = items.indexOf(document.activeElement);
  if (e.key === "ArrowDown") items[(i + 1) % items.length].focus();
  else if (e.key === "ArrowUp") items[(i - 1 + items.length) % items.length].focus();
  else if (e.key === "Home") items[0].focus();
  else if (e.key === "End") items[items.length - 1].focus();
  else return false;
  e.preventDefault();
  return true;
}

export const isMac = navigator.platform.toUpperCase().includes("MAC") || navigator.userAgent.includes("Mac");
export const MOD = isMac ? "⌘" : "Ctrl";

// a small deterministic random, so seeded projects keep their shape across reloads
export function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function downloadText(name, text) {
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
