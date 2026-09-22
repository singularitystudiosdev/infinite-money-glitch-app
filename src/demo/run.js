// demo/run.js: THE player. It reads one script module from demo/scripts and
// plays it on the demo project route (#/p/<id>). A synthetic user types the
// request, the agent plans, the user approves, the goal's account connects,
// and the agent works the first artifact in full: tool calls, notes, the
// screenshots it took, the milestone, the upload and the link. The link is
// opened and closed, two more artifacts land, a week of learning plays at
// five times speed while its numbers run away with it, and the run cuts
// from the count still rising straight to the sign-off.
//
// Nothing here knows which goal it is playing. Every word, every tool, every
// screenshot, every number and every rail tile comes from the script; this
// file only decides WHAT LANDS AND WHEN. A new goal is a new data file in
// demo/scripts, never a new branch here.
// The page's own renderers draw every card.
import { icon } from "../icons.js";
import { liveConnected } from "../live.js";
import { startSim, stopSim } from "../sim.js";
import { agreePlan, completeSetup, createProject, deleteProject, emit, get, project, pushActivity, renameProject, setPlan, setRailOverride } from "../store.js";
import { EASE_OUT, escapeHtml, plainText, popIn, reduceMotion, richText } from "../util.js";
import { actionPopMarkup, connectableAction, dayMarkup, milestoneMarkup, msgMarkup, noteMarkup, planMarkup, revealText, shotMarkup, toolCardSettle, toolMarkup, videoMarkup } from "../ui/chat.js";
import { createPlayer } from "./player.js";
import { mountRecordButton, unmountRecordButton } from "./record.js";
import { scriptFor } from "./scripts/index.js";

// the script being played. Resolved when the route is prepared, so matches()
// stays a pure question
let S = null;

export const matches = (route) => route.page === "project" && Boolean(scriptFor(route.params.id));

let active = null;
export const isActive = () => active !== null;

// the demo project is made fresh every time the route opens, so the run
// always starts from an empty chat
export function prepare(route) {
  S = scriptFor(route.params.id);
  if (!S) return;
  if (project(S.id)) deleteProject(S.id);
  const p = createProject({ name: "New project", template: S.template });
  const state = get();
  const madeId = p.id;
  p.id = S.id;
  p.name = "New project";
  p.thoughts = [];
  state.side.order = [S.id, ...(state.side.order || []).filter((x) => x !== madeId && x !== S.id)];
  emit("projects", { changed: S.id });
}

export function start(view) {
  if (!S) return;
  stop();
  const section = view.querySelector(".app-project");
  if (!section) return;
  stopSim();
  const player = createPlayer();
  active = { player, section };
  mountRecordButton();
  play(section, player).catch((err) => {
    if (!player.stopped) console.error(err);
  });
}

export function stop() {
  if (!active) return;
  const { player, section } = active;
  active = null;
  player.destroy();
  unmountRecordButton();
  section.classList.remove("is-demo-intro");
  document.body.classList.remove("is-demo-intro", "is-demo-white");
  for (const el of document.querySelectorAll(".demo-quote, .demo-outro")) el.remove();
  setRailOverride(null);
  if (!liveConnected()) startSim();
}

// ---------- the run ----------

const easeIn = (t) => t * t * t;
// the shape a number grows in over the week: a slow, near-straight climb
// first, then the curve turns up and runs away. Each number has its own
// lead and its own turn, so the tiles never move in step
// (script.numbers.shapes)
const shape = (lead, pow) => (u) => lead * u + (1 - lead) * Math.pow(u, pow);
// a tile's number, read off the project it belongs to
const READ_TILE = {
  users: (pr) => pr.users.at(-1),
  series: (pr) => pr.users.at(-1),
  views: (pr) => pr.users.at(-1),
  revenue: (pr) => pr.revenue,
};
// anything else is a project stat by that name: a goal's own tile reads its
// own number, so a shop can measure orders where a publisher measures watch
const readStat = (key) => READ_TILE[key] || ((pr) => pr.stats?.[key] ?? 0);
// how a tile is told to roll: the store topic the rail listens on
const TELL_TILE = {
  users: (pr) => emit("users", pr),
  revenue: (pr) => emit("revenue", pr),
};

// what this demo actually captured. assets/demo/capture.mjs records the files
// that landed in the demo's manifest; until a demo has been through the
// capture pass its shots are attempted as before. A file the manifest does
// not list is never requested, so a half-captured demo does not spray 404s
// at its own host for screenshots it was never able to take.
async function capturedFiles() {
  try {
    const r = await fetch(`${S.assets}/manifest.json`);
    if (!r.ok) return null;
    const m = await r.json();
    // an empty inventory is an ANSWER ("nothing captured yet"), not a missing
    // one: a demo whose captures are still owed must request nothing, not
    // everything
    return Array.isArray(m.files) ? new Set(m.files) : null;
  } catch {
    return null;
  }
}

async function play(section, player) {
  const { wait } = player;
  const p = () => project(S.id);
  const chat = section.querySelector("[data-chat]");
  const thread = chat.querySelector("[data-thread]");
  const form = chat.querySelector("[data-composer]");
  const input = form.querySelector(".c-composer__input");
  const sendBtn = form.querySelector("[data-send]");
  const strip = form.querySelector("[data-status]");
  const pop = chat.querySelector("[data-action-pop]");
  const head = chat.querySelector(".app-chat__head");
  const titleEl = chat.querySelector("[data-chat-title]");
  const present = await capturedFiles();
  const assets = preload(present);
  const NUM = S.numbers;
  // each number's own shape, from [lead, pow] in the script
  const SHAPES = Object.fromEntries(Object.entries(NUM.shapes).map(([k, [lead, pow]]) => [k, shape(lead, pow)]));
  const SPEEDS = S.speeds;

  // ---------- drawing into the thread ----------

  const follow = () => {
    thread.scrollTop = thread.scrollHeight;
  };
  const scrollFoot = () => thread.scrollTo({ top: thread.scrollHeight, behavior: reduceMotion() ? "auto" : "smooth" });
  const rise = (el, y = 8) => {
    if (el && !reduceMotion()) el.animate([{ opacity: 0, transform: `translateY(${y}px)` }, { opacity: 1, transform: "translateY(0)" }], { duration: 260, easing: EASE_OUT });
  };
  const append = (html) => {
    thread.insertAdjacentHTML("beforeend", html);
    const el = thread.lastElementChild;
    rise(el);
    scrollFoot();
    return el;
  };
  let thinkRow = null;
  const think = (on) => {
    if (on && !thinkRow) thinkRow = append(`<div class="c-turn"><div class="c-thinking">${icon("loader-circle", "btn__spinner")}<span>Thinking...</span></div></div>`);
    else if (!on && thinkRow) {
      thinkRow.remove();
      thinkRow = null;
    }
  };
  // the strip on the composer's top edge: what the agent is on right now
  const status = (text, label = "") => {
    strip.hidden = !text;
    if (!text) return;
    strip.querySelector("[data-status-label]").textContent = label;
    const el = strip.querySelector("[data-status-text]");
    if (el.textContent === text) return;
    el.textContent = text;
    if (!reduceMotion()) el.animate([{ opacity: 0, transform: "translateY(3px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 200 / player.getSpeed(), easing: EASE_OUT });
  };
  // the agent's line arrives letter by letter at normal speed and whole in
  // the montage, where a typed line would hold the run up
  async function say(text) {
    think(false);
    const msg = append(msgMarkup("assistant", ""));
    if (player.getSpeed() > 1 || reduceMotion()) {
      msg.innerHTML = richText(text);
      scrollFoot();
      return msg;
    }
    msg.classList.add("is-live");
    // the reveal types the plain words; the finished line is drawn whole so
    // its bold and its links are marked up
    await revealText(msg, plainText(text), follow);
    msg.classList.remove("is-live");
    msg.innerHTML = richText(text);
    scrollFoot();
    return msg;
  }
  // a tool call: the row lands with a spinner, ticks done, and its result
  // unfolds under it (the same card the live path draws, chat.js toolMarkup)
  async function runTool(t, { ms = 1100, result = true } = {}) {
    think(false);
    status(`Running ${t.name}`);
    const el = append(toolMarkup({ ...t, status: "running" }, { demo: true }));
    await wait(ms);
    toolCardSettle(el, { status: "done", result: result ? t.result : "" });
    popIn(el.querySelector(".c-tool__status svg"));
    if (result && t.result) {
      rise(el.querySelector(".c-tool__result"), 4);
      scrollFoot();
    }
    return el;
  }
  // a screenshot of what the agent was looking at; a shared one (a
  // generation or voice site) lives beside the goal's own folder
  const shotSrc = (s) => `${s.shared ? S.shared : S.assets}/${s.file}`;
  async function shot(s, ms = 1000) {
    if (present && !present.has(s.file)) return;
    if (!(await assets.has(shotSrc(s)))) return;
    append(shotMarkup(s, shotSrc(s), { demo: true }));
    await wait(ms);
  }
  const note = (text) => append(noteMarkup(text, { demo: true }));
  const day = (n, label) => append(dayMarkup(n, label, { demo: true }));
  // a published artifact: a card that opens the real thing the agent made. A
  // thumbnail that is not on disk is dropped rather than drawn: a broken
  // image is worse than no image
  async function artifactCard(a, title, slot, length) {
    const card = S.artifact(a, title, slot, length);
    if (card.thumb && present && !present.has(a.thumb)) card.thumb = null;
    if (card.thumb && !(await assets.has(card.thumb))) card.thumb = null;
    return append(videoMarkup(card, { demo: true }));
  }
  function addMilestone() {
    const m = S.voice.milestone;
    append(milestoneMarkup({ title: m.title, text: m.text, src: `${S.assets}/${m.src}`, icon: m.icon }));
    // the player is only drawn when the recording exists: an <audio> with a
    // src that was never captured is a 404 and an empty control
    if (!present || present.has(m.src)) append(`<div class="c-media demo-audio"><audio controls preload="metadata" src="${S.assets}/${m.src}"></audio></div>`);
  }
  const log = (kind, text, extra) => pushActivity(S.id, kind, text, extra);

  // ---------- the numbers ----------

  // u runs 0 to 1 over the week: the views curve grows into its shape and
  // every tile climbs toward its closing number along its own shape
  function applyNumbers(u) {
    const pr = p();
    const kv = SHAPES.views(u);
    const kr = SHAPES.revenue(u);
    pr.users = NUM.curve.map((v) => Math.round(v * kv));
    // the 30-day comparison behind the badge: a fraction of each day that
    // shrinks as the week goes on, so the badge climbs with the curve
    pr.history = Array.from({ length: 30 }, (_, i) => {
      const v = pr.users[i] ?? pr.users.at(-1);
      return v ? Math.max(1, Math.round(v / (1.4 + 4 * kv))) : 0;
    });
    // every stat the script names is carried by its own shape toward its own
    // closing number, so a goal can measure orders or conversions as
    // naturally as a publisher measures watch time
    const stats = NUM.stats || NUM.final;
    for (const [key, value] of Object.entries(stats)) {
      if (key === "revenue" || key === "users") continue;
      const sh = SHAPES[key] || SHAPES.views;
      pr.stats[key] = Math.round(value * sh(u));
    }
    pr.revenue = Math.round(NUM.final.revenue * kr);
    pr.baseline = pr.revenue ? Math.max(1, Math.round(pr.revenue / (1 + 2.6 * kr))) : 0;
  }
  // each card is told to roll only when its own number moved, and no more
  // often than its own beat, so the rail ticks over tile by tile rather
  // than all at once (script.numbers.tiles)
  const TILES = NUM.tiles.map((t) => ({
    id: t.id,
    every: t.every,
    read: readStat(t.read || t.id),
    tell: t.tell === "stats" ? (pr) => emit("stats", { project: pr, tile: t.id }) : TELL_TILE[t.tell] || TELL_TILE.users,
  }));
  const shown = {};
  const toldAt = {};
  function pulse(force = false) {
    const pr = p();
    const now = performance.now();
    for (const t of TILES) {
      const v = t.read(pr);
      if (!force && (v === shown[t.id] || now - (toldAt[t.id] || 0) < t.every)) continue;
      shown[t.id] = v;
      toldAt[t.id] = now;
      t.tell(pr);
    }
  }
  // u moves on its own clock: a segment carries it from where it is to a
  // target over a stretch of time, and the ticker reads it as it passes.
  // The run never waits on the numbers, so a day can end, or the sign-off
  // land, while every tile is still rolling
  let uNow = 0;
  let segment = null;
  function setProgress(u) {
    uNow = u;
    segment = null;
    applyNumbers(u);
    pulse(true);
  }
  const moveNumbers = (to, ms) => {
    segment = { from: uNow, to, t0: performance.now(), ms };
  };
  function startNumbers() {
    const run = active;
    const step = () => {
      if (active !== run) return;
      if (segment) {
        const t = Math.min(1, (performance.now() - segment.t0) / segment.ms);
        uNow = segment.from + (segment.to - segment.from) * t;
        if (t >= 1) segment = null;
        applyNumbers(uNow);
        logCrossings();
      }
      pulse();
      setTimeout(step, 100);
    };
    step();
  }
  // the missions on the rail move along and finish; a finished one stays on
  // the card reading done. Nothing retires, so the lane never draws a task
  // from the pool to take its place and no row repaints under the reader
  function pushMissions(step) {
    const pr = p();
    for (const m of pr.missions.filter((x) => x.lane === "manager" && x.progress < 100)) {
      m.progress = Math.min(100, m.progress + step + Math.floor(Math.random() * 10));
      emit("mission", { project: pr, mission: m });
      if (m.progress >= 100) log("mission", `Mission done: ${m.title}`);
    }
  }
  // the count passing a round number is worth a line in the log
  let crossed = 0;
  function logCrossings() {
    const c = NUM.crossing;
    const read = readStat(c.read);
    const thousands = Math.floor(read(p()) / c.step) * (c.step / 1000);
    if (thousands <= crossed) return;
    crossed = thousands;
    log(c.kind, c.text(thousands));
  }

  // ---------- scene 0: the brand green, the box, and one line ----------

  // only the composer is on the page; the quote fades in above it, easing
  // up from a touch smaller, then the name under it
  status("");
  section.classList.add("is-demo-intro");
  document.body.classList.add("is-demo-intro");
  const quote = document.createElement("div");
  quote.className = "demo-quote";
  quote.innerHTML = `<p class="demo-quote__text">${escapeHtml(S.quote.text)}</p><p class="demo-quote__by">${escapeHtml(S.quote.by)}</p>`;
  chat.append(quote);
  // the display face is fetched from the web: the line waits for it (a
  // moment at most) so it never swaps typeface as it appears
  await Promise.race([document.fonts.load("400 76px Anton").catch(() => {}), wait(1500)]);
  await wait(400);
  quote.querySelector(".demo-quote__text").classList.add("is-in");
  await wait(700);
  quote.querySelector(".demo-quote__by").classList.add("is-in");
  await wait(1900);

  // the line lets go first, the green gives way to white under it, and
  // only once the page has settled does the hand reach for the box
  quote.classList.add("is-out");
  await wait(500);
  document.body.classList.add("is-demo-white");
  await wait(1100);
  quote.remove();

  // ---------- scene 1: the request ----------

  await player.moveTo(input, { dx: -120 });
  input.focus({ preventScroll: true });
  await wait(250);
  // a quick typist: about 90 words a minute, a touch slower on the spaces
  for (const ch of S.request) {
    input.value += ch;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await wait(11 + Math.random() * 17 + (ch === " " ? 11 : 0));
  }
  await wait(300);
  await player.click(sendBtn);
  if (!reduceMotion()) sendBtn.animate([{ transform: "translateY(0)" }, { transform: "translateY(-3px)", offset: 0.4 }, { transform: "translateY(0)" }], { duration: 300, easing: EASE_OUT });
  input.value = "";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.blur();
  append(msgMarkup("user", S.request));
  log("user", `You: ${S.request}`);
  player.hideCursor();
  // the rest of the app comes up around the conversation
  section.classList.remove("is-demo-intro");
  document.body.classList.remove("is-demo-intro", "is-demo-white");

  // ---------- scene 2: thinking, then the plan ----------

  // the opening think runs about three times faster than the rest of the
  // demo: the request is read in under two seconds, not six
  await wait(170);
  think(true);
  status("Thinking", "");
  await wait(230);
  renameProject(S.id, S.title);
  titleEl.textContent = S.title;
  document.title = S.title;
  rise(titleEl, 4);
  for (const line of S.thinking.request) {
    status(line);
    await wait(500);
  }
  await say(S.planSay(S.title));
  setPlan(S.id, S.plan);
  const plan = append(planMarkup(p()));
  status(S.status.waiting);
  await wait(1770);
  await player.click(plan.querySelector("[data-plan-agree]"));
  agreePlan(S.id);
  const agreed = thread.querySelector("[data-plan-card]");
  if (agreed && !reduceMotion()) agreed.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: 300, easing: EASE_OUT });
  await wait(300);
  append(msgMarkup("user", "Looks good, go ahead"));
  player.hideCursor();
  await wait(600);

  // ---------- scene 3: the account, under the user's sign-in ----------

  const C = S.connect;
  think(true);
  status(C.statusOpening);
  await wait(900);
  await say(C.say);
  // the popup is the live popup's own renderer over an action item: the demo
  // does not hand-write this markup, which is how the two would drift
  pop.innerHTML = actionPopMarkup(connectableAction({ id: `${S.id}-connect`, kind: "action", probe: C.probe, platform: C.platform, mark: C.mark, auth: C.auth, title: C.title, url: C.url }));
  pop.dataset.phase = "connect";
  pop.hidden = false;
  // the popup makes the composer taller: the last line stays in view
  requestAnimationFrame(follow);
  await wait(1100);
  const connect = pop.querySelector("[data-action-connect]");
  await player.click(connect);
  pop.dataset.phase = "verifying";
  connect.disabled = true;
  connect.innerHTML = `${icon("loader-circle", "c-tool__spin")}<span class="c-action__label">Verifying</span>`;
  status(C.statusWaiting);
  await wait(1700);
  pop.dataset.phase = "connected";
  connect.innerHTML = `${icon("check", "c-action__check")}<span class="c-action__label">Connected</span>`;
  log("setup", C.log(S.account));
  await wait(1300);
  if (!reduceMotion()) await pop.animate([{ opacity: 1 }, { opacity: 0, transform: "translateY(4px)" }], { duration: 180, easing: EASE_OUT }).finished;
  pop.hidden = true;
  pop.innerHTML = "";
  player.hideCursor();
  // the rail: the analytics card first, the activity under it. The chat's
  // own "all set" line is skipped (the marker below is what it looks for)
  setRailOverride("classic");
  const pr = p();
  const SET = S.setup;
  pr.setup.done = [...SET.done];
  pr.setup.summary = { ...SET.summary };
  pr.thread.push({ kind: "thought", text: "", setupDone: true, at: Date.now() });
  completeSetup(S.id);
  // the rail's missions are this run's own, in the order they happen, and
  // none of them ever leaves the card, so no pooled task can land in the
  // middle of the story
  pr.missions = SET.missions.map((m) => ({ ...m, lane: "manager" }));
  // running count is all there is: neither lane is ever topped back up
  pr.laneCount = { manager: pr.missions.length, subagent: 0 };
  for (const m of pr.missions) emit("mission:new", { project: pr, mission: m });
  setProgress(0);
  await wait(500);
  status(SET.status);
  await wait(600);
  await runTool(SET.tool, { ms: 1300 });
  log("setup", SET.log(SET));
  await say(SET.line(SET));

  // ---------- scene 4: the first artifact, in full ----------

  think(true);
  status(S.workStatus[0]);
  await wait(1300);
  for (const [i, step] of S.work.entries()) {
    if (S.workStatus[i]) status(S.workStatus[i]);
    await runTool(step.tool);
    if (step.shot) await shot(step.shot);
    if (step.note) {
      note(step.note);
      await wait(900);
    }
  }
  log("work", S.workLog);
  await say(S.workSay);
  status(S.workStatus[3]);
  for (const g of S.media) {
    await runTool(g.tool, { ms: 1400 });
    if (g.shot) await shot(g.shot, 900);
  }
  note(S.mediaNote);
  log(S.mediaInsight.kind, S.mediaInsight.text, { delta: S.mediaInsight.delta });
  pushMissions(SET.steps.first);
  await wait(1000);
  status(S.workStatus[4]);
  await runTool(S.voice.tool, { ms: 1500 });
  await shot(S.voice.shot, 800);
  // the milestone's own renderer draws the level wave for an audio artifact
  // (chat.js waveMarkup), so the demo card and the live card are the same
  // markup
  addMilestone();
  log("work", S.voiceLog);
  await wait(1600);
  status(S.workStatus[5]);
  await runTool(S.render, { ms: 1600 });
  const first = S.videos[0];
  const firstTitle = S.titles[0];
  await runTool(S.upload(firstTitle, S.slots[0]), { ms: 1500 });
  const card1 = await artifactCard(first, firstTitle, S.slots[0], S.firstLength);
  log(S.logs.upload, `Uploaded: ${firstTitle}, ${S.firstLength}`);
  pushMissions(SET.steps.upload);
  await say(S.liveSay(firstTitle, first.url, S.slots[0]));
  status(S.status.cutting);

  // ---------- scene 5: the link, opened and closed ----------

  await wait(900);
  await player.click(card1);
  // the page is the generated clip when it is on disk, the real embed if not
  const generated = `${S.assets}/${S.generated.file}`;
  // the manifest already says whether this clip is on disk: asking with a HEAD
  // is a request for a file that is not there, which is what the "0 failed
  // requests" gate counts
  const hasClip = present && !present.has(S.generated.file) ? false : await fetch(generated, { method: "HEAD" }).then((r) => r.ok).catch(() => false);
  const back = await player.openBrowser({ url: first.url, video: hasClip ? generated : null, embed: S.embedUrl ? S.embedUrl(first.id) : first.url });
  // the user comes back 0.1 s before the clip ends, never after it: the
  // pointer glides to the back button as the clip nears its end (the glide
  // takes about 0.65 s), the press goes down 0.18 s before the leaving
  // moment (a press is 90 ms down and 70 ms up, and its timers run about
  // 20 ms late) and the window starts sliding away at duration minus
  // 0.1 s, while the clip is still moving. Measured with .tmp/pw/back-
  // measure.mjs. With no clip on disk (the embed), or a clip the browser
  // would not start, it is a plain five-second look
  const duration = hasClip ? await player.videoDuration() : null;
  if (duration && player.videoPlaying()) {
    const leave = duration - 0.1;
    const pressDown = leave - 0.18;
    await player.waitForVideoTime(pressDown - 0.7, (duration + 2) * 1000);
    await player.moveTo(back);
    await player.waitForVideoTime(pressDown, 2000);
    await player.press();
  } else {
    await wait(5200);
    await player.click(back);
  }
  await player.closeBrowser();
  player.hideCursor();
  await wait(500);

  // ---------- scene 6: the second and third artifacts ----------

  player.setSpeed(1.6);
  // from here the numbers move on their own clock
  startNumbers();
  for (const more of S.more) {
    status(S.moreStatus(more.slot));
    think(true);
    await wait(900);
    await runTool(more.gen, { ms: 1300 });
    await runTool(more.voice, { ms: 900, result: false });
    await runTool(S.upload(more.title, more.slot), { ms: 1200 });
    await artifactCard(more.video, more.title, more.slot, more.length);
    log(S.logs.upload, `Uploaded: ${more.title}`);
    moveNumbers(more.numbers, 2400);
    pushMissions(SET.steps.more);
    await wait(700);
  }
  await say(S.weekIntro);
  await wait(1200);

  // ---------- scene 7: a week at five times speed, then faster ----------

  const speedLabel = (s) => `${s.toLocaleString("en-US", { maximumFractionDigits: 1 })}× speed`;
  head.insertAdjacentHTML("beforeend", `<span class="demo-speed" data-demo-speed>${icon("fast-forward")}<span data-demo-speed-label>${speedLabel(SPEEDS[0])}</span></span>`);
  const badge = head.querySelector("[data-demo-speed]");
  popIn(badge);
  player.setSpeed(SPEEDS[0]);
  let uploads = 3;
  let titleIndex = 3;
  // one day's beats, in the run's own milliseconds, before the speed
  // divides them: the numbers are given the same stretch to move in
  const DAY_MS = 900 + 2 * 1000 + 1100 + S.slots.length * (700 + 500) + 700;
  for (const [n, d] of S.week.entries()) {
    // the week picks up as it goes; the badge says so
    if (SPEEDS[n] !== player.getSpeed()) {
      player.setSpeed(SPEEDS[n]);
      const label = badge.querySelector("[data-demo-speed-label]");
      label.textContent = speedLabel(SPEEDS[n]);
      rise(label, 3);
    }
    // where the numbers stand by the end of this day: barely moved over
    // the first days, then the curve turns up and the last of them run away
    const subsBefore = p().stats.subs;
    moveNumbers(0.1 + 0.8 * easeIn((n + 1) / S.week.length), DAY_MS / player.getSpeed());
    day(d.day);
    status(S.weekStatus(d.day, "reading yesterday's numbers"));
    await wait(900);
    for (const t of d.tools) await runTool(t, { ms: 1000 });
    note(d.note);
    log("insight", d.note.split(". ")[0], { delta: 12 + n * 9 });
    await wait(1100);
    for (const [k, slot] of S.slots.entries()) {
      const v = S.videos[(uploads + k) % S.videos.length];
      const title = S.titles[titleIndex % S.titles.length];
      titleIndex += 1;
      status(S.weekStatus(d.day, `the ${slot} upload`));
      await runTool(S.upload(title, slot), { ms: 700, result: false });
      await artifactCard(v, title, slot, S.weekUploadLengths[k]);
      log(S.logs.upload, `Uploaded: ${title}`);
      await wait(500);
    }
    uploads += 3;
    // the log reads the tiles' own numbers, so the two never disagree
    const gained = p().stats.subs - subsBefore;
    if (gained > 0) log(S.logs.delta, NUM.gainedLine(gained.toLocaleString("en-US")));
    log(S.logs.day, NUM.dayLine(d.day, p().users.at(-1).toLocaleString("en-US")));
    pushMissions(SET.steps.week);
    await wait(700);
  }

  // ---------- scene 8: the numbers, and the cut ----------

  // no zoom and no report line: the week left the count rising, it keeps
  // rising here in real time, and the sign-off lands on top of it while
  // the tiles are still rolling — the run cuts from numbers actively
  // running up straight to the outro
  status(S.status.readingWeek);
  player.setSpeed(1);
  // the last stretch of the curve is the steepest: the tiles are running
  // hardest as the page cuts away
  moveNumbers(1, 3400);
  if (!reduceMotion()) await badge.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: EASE_OUT }).finished;
  badge.remove();
  await wait(1200);

  // ---------- scene 9: the sign-off ----------

  // the page gives way to the brand colour, the mark settles in, then the
  // name fades up under it
  const outro = document.createElement("div");
  outro.className = "demo-outro";
  outro.innerHTML = `<img class="demo-outro__logo" src="${S.shared}/${S.outro.logo}" alt="" width="512" height="512"><span class="demo-outro__name">${escapeHtml(S.outro.name)}</span><button type="button" class="demo-outro__replay" data-demo-replay>${icon("rotate-ccw")}<span>Replay</span></button>`;
  document.body.append(outro);
  outro.querySelector("[data-demo-replay]").addEventListener("click", () => location.reload());
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  outro.classList.add("is-in");
  await wait(900);
  outro.querySelector(".demo-outro__logo").classList.add("is-in");
  await wait(1100);
  outro.querySelector(".demo-outro__name").classList.add("is-in");
  await wait(2400);
  outro.querySelector(".demo-outro__replay").classList.add("is-in");
}

// the images the run shows, fetched while the request is still being
// typed; a screenshot that is not on disk is skipped rather than broken
function preload(present = null) {
  const loads = new Map();
  // src is the whole path from the page root
  const has = (src) => {
    if (!loads.has(src)) {
      loads.set(
        src,
        new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve(true);
          img.onerror = () => resolve(false);
          img.src = src;
        }),
      );
    }
    return loads.get(src);
  };
  const full = (s) => `${s.shared ? S.shared : S.assets}/${s.file}`;
  for (const s of [...S.work, ...S.media, S.voice]) if (s.shot && (!present || present.has(s.shot.file))) has(full(s.shot));
  for (const v of S.videos) if (!present || present.has(v.thumb)) has(`${S.assets}/${v.thumb}`);
  return { has };
}