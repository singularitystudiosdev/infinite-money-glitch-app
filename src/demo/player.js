// demo/player.js: the pieces a scripted demo run is made of. A clock that
// waits in demo seconds (a speed multiplier shortens every wait at once), a
// synthetic pointer that glides to an element and presses it, and an
// in-app browser window that slides over the page to show a link opened
// and slid away again. Nothing here knows the story; run.js tells it.
import { reduceMotion } from "../util.js";

const POINTER = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 3.2l12.3 11.7-5.3.6 3 6.4-2.6 1.2-3-6.4-4.1 3.5z" fill="#fff" stroke="#14171c" stroke-width="1.5" stroke-linejoin="round"/></svg>`;

export function createPlayer() {
  let speed = 1;
  let stopped = false;
  const timers = new Set();

  // a wait in demo time: x5 makes every pause a fifth as long. A stopped
  // player never resolves, so a run that was left behind cannot keep acting
  const wait = (ms) =>
    new Promise((resolve) => {
      if (stopped) return;
      const t = setTimeout(() => {
        timers.delete(t);
        if (!stopped) resolve();
      }, Math.max(0, ms / speed));
      timers.add(t);
    });
  const setSpeed = (n) => (speed = n);
  const getSpeed = () => speed;

  // ---------- the pointer ----------

  const cursor = document.createElement("div");
  cursor.className = "demo-cursor";
  cursor.innerHTML = POINTER;
  cursor.hidden = true;
  document.body.append(cursor);
  let at = { x: innerWidth / 2, y: innerHeight / 2 };
  const place = (x, y) => {
    at = { x, y };
    cursor.style.transform = `translate(${x}px, ${y}px)`;
  };
  place(at.x, at.y);

  const centerOf = (target, { dx = 0, dy = 0 } = {}) => {
    if (!target) return at;
    if (target.x !== undefined) return { x: target.x + dx, y: target.y + dy };
    const r = target.getBoundingClientRect();
    return { x: r.left + r.width / 2 + dx, y: r.top + r.height / 2 + dy };
  };
  // the glide takes longer the farther it goes, as a hand does. A pointer
  // that was away comes in from a little below its target and fades up as
  // it settles, the way a cursor re-entering a recording does
  async function moveTo(target, opts = {}) {
    const to = centerOf(target, opts);
    const wasHidden = cursor.hidden;
    cursor.hidden = false;
    const dist = Math.hypot(to.x - at.x, to.y - at.y);
    const ms = Math.min(600, 180 + dist * 0.38);
    if (wasHidden) {
      cursor.style.transition = "none";
      cursor.style.opacity = "0";
      cursor.style.transform = `translate(${to.x}px, ${to.y + 44}px)`;
      void cursor.offsetWidth;
      cursor.style.transition = `transform ${ms / speed}ms cubic-bezier(0.2, 0, 0, 1), opacity ${Math.min(420, ms * 0.7) / speed}ms ease-out`;
      cursor.style.opacity = "1";
    } else {
      cursor.style.transition = `transform ${ms / speed}ms cubic-bezier(0.2, 0, 0, 1)`;
    }
    place(to.x, to.y);
    await wait(ms + 30);
  }
  // a press: the pointer dips for a beat and that is all. No real click
  // event is fired: the run decides what the press means, so the page's
  // own handlers never race the script
  async function press() {
    cursor.classList.add("is-down");
    await wait(90);
    cursor.classList.remove("is-down");
    await wait(70);
  }
  const click = async (target, opts) => {
    await moveTo(target, opts);
    await press();
  };
  const hideCursor = () => {
    cursor.hidden = true;
  };

  // ---------- the browser window ----------

  const browser = document.createElement("div");
  browser.className = "demo-browser";
  browser.hidden = true;
  browser.innerHTML = `<div class="demo-browser__bar"><span class="demo-browser__dots"><i></i><i></i><i></i></span><button type="button" class="demo-browser__back" data-demo-back aria-label="Back to the app"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7M19 12H5"/></svg></button><span class="demo-browser__url" data-demo-url></span></div><div class="demo-browser__page" data-demo-page></div>`;
  document.body.append(browser);
  // a real page in a frame: YouTube's own embed for a video, so the link
  // the agent posted is seen to lead somewhere real
  // a local clip plays as the page itself (the generated video); with no
  // clip, YouTube's own embed of the linked video stands in
  async function openBrowser({ url, embed, video }) {
    browser.querySelector("[data-demo-url]").textContent = url.replace(/^https?:\/\/(www\.)?/, "");
    const page = browser.querySelector("[data-demo-page]");
    page.innerHTML = video
      ? `<video class="demo-browser__frame demo-browser__video" src="${video}" autoplay muted playsinline preload="auto"></video>`
      : `<iframe class="demo-browser__frame" src="${embed}" title="Video" allow="autoplay; encrypted-media; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
    page.querySelector("video")?.play?.().catch((err) => console.error(err));
    browser.hidden = false;
    browser.classList.remove("is-open");
    // one frame later so the slide runs from the hidden position
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    browser.classList.add("is-open");
    await wait(560);
    return browser.querySelector("[data-demo-back]");
  }
  // the clip inside the window: its length once the metadata is in, whether
  // it is actually running, and a wait that resolves the moment its playhead
  // reaches a time (polled every frame, so it lands within about 16 ms), or
  // when the clip ends, or at a ceiling, whichever comes first
  const videoEl = () => browser.querySelector("video");
  async function videoDuration() {
    const v = videoEl();
    if (!v) return null;
    if (!(Number.isFinite(v.duration) && v.duration > 0)) {
      await new Promise((resolve) => {
        v.addEventListener("loadedmetadata", resolve, { once: true });
        setTimeout(resolve, 3000);
      });
    }
    return Number.isFinite(v.duration) && v.duration > 0 ? v.duration : null;
  }
  const videoPlaying = () => {
    const v = videoEl();
    return !!v && !v.paused && !v.ended;
  };
  const waitForVideoTime = (sec, ceilingMs) =>
    new Promise((resolve) => {
      const v = videoEl();
      if (!v || stopped) return resolve();
      let raf = 0;
      const ceiling = setTimeout(() => {
        cancelAnimationFrame(raf);
        timers.delete(ceiling);
        resolve();
      }, ceilingMs);
      timers.add(ceiling);
      const tick = () => {
        if (stopped) return;
        if (v.currentTime >= sec || v.ended) {
          clearTimeout(ceiling);
          timers.delete(ceiling);
          resolve();
          return;
        }
        raf = requestAnimationFrame(tick);
      };
      tick();
    });

  async function closeBrowser() {
    browser.classList.remove("is-open");
    await wait(480);
    browser.hidden = true;
    browser.querySelector("[data-demo-page]").innerHTML = "";
  }

  function destroy() {
    stopped = true;
    for (const t of timers) clearTimeout(t);
    timers.clear();
    cursor.remove();
    browser.remove();
  }

  return { wait, setSpeed, getSpeed, moveTo, press, click, hideCursor, openBrowser, closeBrowser, videoDuration, videoPlaying, waitForVideoTime, destroy, get stopped() { return stopped; } };
}
