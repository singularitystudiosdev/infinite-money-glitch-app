// demo/run.js: the scripted run on the demo project (#/p/new-project-hlug).
// A synthetic user types the request, the agent plans, the user approves,
// YouTube connects, and the agent works the first video in full: tool
// calls, notes, the screenshots it took, the voiceover, the upload and the
// link. The link is opened and closed, two more uploads land, a week of
// learning plays at five times speed while its numbers run away with it,
// and the run cuts from the count still climbing straight to the sign-off.
// The page's own renderers draw every card; this file only decides what
// lands and when.
import { YOUTUBE_MARK, icon } from "../icons.js";
import { liveConnected } from "../live.js";
import { startSim, stopSim } from "../sim.js";
import { agreePlan, completeSetup, createProject, deleteProject, emit, get, project, pushActivity, renameProject, setPlan, setRailOverride } from "../store.js";
import { EASE_OUT, escapeHtml, plainText, popIn, reduceMotion, richText } from "../util.js";
import { milestoneMarkup, msgMarkup, planMarkup, revealText } from "../ui/chat.js";
import { createPlayer } from "./player.js";
import { mountRecordButton, unmountRecordButton } from "./record.js";
import { ACCOUNT, ASSETS, CHANNEL, DEMO_ID, FINAL, FIRST_VIDEO, GENERATED, GENERATION, GENERATION_NOTE, HANDLE, OUTRO, PLAN, QUOTE, RENDER, REQUEST, SHARED, SLOTS, THINKING, TITLE, UPLOAD, VIDEOS, VIEWS_CURVE, VOICE, WEEK, WEEK_TITLES } from "./script.js";

export const matches = (route) => route.page === "project" && route.params.id === DEMO_ID;

let active = null;
export const isActive = () => active !== null;

// the demo project is made fresh every time the route opens, so the run
// always starts from an empty chat
export function prepare() {
  if (project(DEMO_ID)) deleteProject(DEMO_ID);
  const p = createProject({ name: "New project", template: "channel" });
  const state = get();
  const madeId = p.id;
  p.id = DEMO_ID;
  p.name = "New project";
  p.thoughts = [];
  state.side.order = [DEMO_ID, ...(state.side.order || []).filter((x) => x !== madeId && x !== DEMO_ID)];
  emit("projects", { changed: DEMO_ID });
}

export function start(view) {
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
// lead and its own turn, so the tiles never move in step: views turn
// first, watch hours and subscribers follow, comments trail them, and
// revenue is the last to move
const shape = (lead, pow) => (u) => lead * u + (1 - lead) * Math.pow(u, pow);
const SHAPES = { views: shape(0.2, 3.4), watch: shape(0.2, 3.9), subs: shape(0.15, 4.4), comments: shape(0.12, 5), revenue: shape(0.08, 5.6) };
// the week runs faster as it goes: five times at the start, eight by the
// last day
const WEEK_SPEEDS = [5, 5, 5.5, 6, 6.5, 7, 8];

async function play(section, player) {
  const { wait } = player;
  const p = () => project(DEMO_ID);
  const chat = section.querySelector("[data-chat]");
  const thread = chat.querySelector("[data-thread]");
  const form = chat.querySelector("[data-composer]");
  const input = form.querySelector(".c-composer__input");
  const sendBtn = form.querySelector("[data-send]");
  const strip = form.querySelector("[data-status]");
  const pop = form.querySelector("[data-action-pop]");
  const head = chat.querySelector(".app-chat__head");
  const titleEl = chat.querySelector("[data-chat-title]");
  const assets = preload();

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
  const toolIcon = (name) => (name === "youtube" ? YOUTUBE_MARK : icon(name));
  // a tool call: the row lands with a spinner, ticks done, and its result
  // unfolds under it
  async function runTool(t, { ms = 1100, result = true } = {}) {
    think(false);
    status(`Running ${t.name}`);
    const el = append(`<details class="c-tool demo-tool" open><summary><span class="c-tool__icon">${toolIcon(t.icon)}</span><span class="c-tool__call"><span class="c-tool__name">${escapeHtml(t.name)}</span><span class="c-tool__args">${escapeHtml(t.args)}</span></span><span class="c-tool__status">${icon("loader-circle", "c-tool__spin")}</span></summary><pre class="c-tool__result" hidden>${escapeHtml(t.result || "")}</pre></details>`);
    await wait(ms);
    el.classList.add("is-done");
    const st = el.querySelector(".c-tool__status");
    st.innerHTML = icon("check");
    popIn(st.querySelector("svg"));
    if (result && t.result) {
      const res = el.querySelector(".c-tool__result");
      res.hidden = false;
      rise(res, 4);
      scrollFoot();
    }
    return el;
  }
  // a screenshot of what the agent was looking at; a shared one (the
  // generation and voice sites) lives beside the niche's own folder
  const shotSrc = (s) => `${s.shared ? SHARED : ASSETS}/${s.file}`;
  async function shot(s, ms = 1000) {
    if (!(await assets.has(shotSrc(s)))) return;
    append(`<figure class="c-shot demo-shot"><img src="${shotSrc(s)}" alt="${escapeHtml(s.caption)}" width="1280" height="800"><figcaption>${icon("camera")}<span>${escapeHtml(s.caption)}</span></figcaption></figure>`);
    await wait(ms);
  }
  const note = (text) => append(`<div class="demo-note">${icon("pencil")}<span><strong>Note</strong> ${escapeHtml(text)}</span></div>`);
  const day = (n, label) => append(`<div class="demo-day"><span>Day ${n}${label ? ` · ${label}` : ""}</span></div>`);
  const videoCard = (v, title, slot, length) =>
    append(`<a class="c-milestone is-viewable demo-video" href="${escapeHtml(v.url)}" target="_blank" rel="noopener"><img class="demo-video__thumb" src="${ASSETS}/${v.thumb}" alt="" width="160" height="90"><span class="c-milestone__body"><span class="c-milestone__title">Uploaded: ${escapeHtml(title)}</span><span class="c-milestone__text"><span class="demo-video__mark">${YOUTUBE_MARK}</span>youtube.com/watch?v=${escapeHtml(v.id)} · ${slot} · ${length}</span></span>${icon("arrow-up-right", "c-milestone__open")}</a>`);
  const log = (kind, text, extra) => pushActivity(DEMO_ID, kind, text, extra);

  // ---------- the numbers ----------

  // u runs 0 to 1 over the week: the views curve grows into its shape and
  // every tile climbs toward its closing number along its own shape
  function applyNumbers(u) {
    const pr = p();
    const kv = SHAPES.views(u);
    const kr = SHAPES.revenue(u);
    pr.users = VIEWS_CURVE.map((v) => Math.round(v * kv));
    // the 30-day comparison behind the badge: a fraction of each day that
    // shrinks as the week goes on, so the badge climbs with the curve
    pr.history = Array.from({ length: 30 }, (_, i) => {
      const v = pr.users[i] ?? pr.users.at(-1);
      return v ? Math.max(1, Math.round(v / (1.4 + 4 * kv))) : 0;
    });
    pr.stats.subs = Math.round(FINAL.subs * SHAPES.subs(u));
    pr.stats.comments = Math.round(FINAL.comments * SHAPES.comments(u));
    pr.stats.watch = Math.round(FINAL.watch * SHAPES.watch(u));
    pr.revenue = Math.round(FINAL.revenue * kr);
    pr.baseline = pr.revenue ? Math.max(1, Math.round(pr.revenue / (1 + 2.6 * kr))) : 0;
  }
  // each card is told to roll only when its own number moved, and no more
  // often than its own beat, so the rail ticks over tile by tile rather
  // than all at once
  const TILES = [
    { id: "series", every: 260, read: (pr) => pr.users.at(-1), tell: (pr) => emit("users", pr) },
    { id: "subs", every: 200, read: (pr) => pr.stats.subs, tell: (pr) => emit("stats", { project: pr, tile: "subs" }) },
    { id: "watch", every: 340, read: (pr) => pr.stats.watch, tell: (pr) => emit("stats", { project: pr, tile: "watch" }) },
    { id: "comments", every: 390, read: (pr) => pr.stats.comments, tell: (pr) => emit("stats", { project: pr, tile: "comments" }) },
    { id: "revenue", every: 430, read: (pr) => pr.revenue, tell: (pr) => emit("revenue", pr) },
  ];
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
    const thousands = Math.floor(p().stats.subs / 2000) * 2;
    if (thousands <= crossed) return;
    crossed = thousands;
    log("subscriber", `Subscribers crossed ${thousands}k`);
  }

  // ---------- scene 0: the brand green, the box, and one line ----------

  // only the composer is on the page; the quote fades in above it, easing
  // up from a touch smaller, then the name under it
  status("");
  section.classList.add("is-demo-intro");
  document.body.classList.add("is-demo-intro");
  const quote = document.createElement("div");
  quote.className = "demo-quote";
  quote.innerHTML = `<p class="demo-quote__text">${escapeHtml(QUOTE.text)}</p><p class="demo-quote__by">${escapeHtml(QUOTE.by)}</p>`;
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
  for (const ch of REQUEST) {
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
  append(msgMarkup("user", REQUEST));
  log("user", `You: ${REQUEST}`);
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
  renameProject(DEMO_ID, TITLE);
  titleEl.textContent = TITLE;
  document.title = TITLE;
  rise(titleEl, 4);
  for (const line of THINKING.request) {
    status(line);
    await wait(500);
  }
  await say(`Here is the plan for ${TITLE}. It opens the channel under your own Google sign-in, keeps three uploads a day, and tests its way to what the audience watches. Change anything, or approve it and I start.`);
  setPlan(DEMO_ID, PLAN);
  const plan = append(planMarkup(p()));
  status("Waiting on the plan");
  await wait(1770);
  await player.click(plan.querySelector("[data-plan-agree]"));
  agreePlan(DEMO_ID);
  const agreed = thread.querySelector("[data-plan-card]");
  if (agreed && !reduceMotion()) agreed.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: 300, easing: EASE_OUT });
  await wait(300);
  append(msgMarkup("user", "Looks good, go ahead"));
  player.hideCursor();
  await wait(600);

  // ---------- scene 3: the channel, under the user's sign-in ----------

  think(true);
  status("Opening the channel");
  await wait(900);
  await say("Great, that is the plan. One thing from you: sign in to YouTube once with your Google account and I open the channel under it. I keep the token, never the password.");
  pop.innerHTML = `<span class="c-action__mark">${YOUTUBE_MARK}</span><span class="c-action__title">Connect YouTube Account</span><button type="button" class="c-action__btn" data-demo-connect><span class="c-action__label">Connect</span></button>`;
  pop.dataset.phase = "connect";
  pop.hidden = false;
  // the popup makes the composer taller: the last line stays in view
  requestAnimationFrame(follow);
  await wait(1100);
  const connect = pop.querySelector("[data-demo-connect]");
  await player.click(connect);
  pop.dataset.phase = "verifying";
  connect.disabled = true;
  connect.innerHTML = `${icon("loader-circle", "c-tool__spin")}<span class="c-action__label">Verifying</span>`;
  status("Waiting on Google sign-in");
  await wait(1700);
  pop.dataset.phase = "connected";
  connect.innerHTML = `${icon("check", "c-action__check")}<span class="c-action__label">Connected</span>`;
  log("setup", `YouTube connected as ${ACCOUNT}`);
  await wait(1300);
  if (!reduceMotion()) await pop.animate([{ opacity: 1 }, { opacity: 0, transform: "translateY(4px)" }], { duration: 180, easing: EASE_OUT }).finished;
  pop.hidden = true;
  pop.innerHTML = "";
  player.hideCursor();
  // the rail: the analytics card first, the activity under it. The chat's
  // own "all set" line is skipped (the marker below is what it looks for)
  setRailOverride("classic");
  const pr = p();
  pr.setup.done = ["youtube", "card", "stripe"];
  pr.setup.summary = { youtube: `Channel ${CHANNEL}, ${ACCOUNT}`, card: "Visa ending 4242", stripe: "Stripe, connected" };
  pr.thread.push({ kind: "thought", text: "", setupDone: true, at: Date.now() });
  completeSetup(DEMO_ID);
  // the rail's missions are this run's own: three pieces of climb-video work
  // in the order they happen, and none of them ever leaves the card, so no
  // pooled task can land in the middle of the story
  pr.missions = [
    { id: "demo-first-video", title: "First video: the hold breaks", site: "YouTube Studio", url: "https://studio.youtube.com", icon: "clapperboard", progress: 38, steps: ["Writing the script from the wall footage", "Generating the crag scene in three models", "Recording the voiceover", "Rendering and uploading the 06:00 video"] },
    { id: "demo-thumbs", title: "Thumbnail tests on the fall footage", site: "YouTube Studio", url: "https://studio.youtube.com", icon: "image", progress: 16, steps: ["Pulling three frames from the crag clip", "Cutting the caught fall into the corner", "Scoring each against the last upload", "Switching the queue to the winner"] },
    { id: "demo-schedule", title: "Three uploads a day, on the hour", site: "YouTube Studio", url: "https://studio.youtube.com", icon: "calendar-clock", progress: 0, steps: ["Reading the first video's watch time by hour", "Placing the 06:00, 12:00 and 18:00 slots", "Writing the descriptions and tags", "Scheduling tomorrow's three"] },
  ].map((m) => ({ ...m, lane: "manager" }));
  // three running is all there is: neither lane is ever topped back up
  pr.laneCount = { manager: pr.missions.length, subagent: 0 };
  for (const m of pr.missions) emit("mission:new", { project: pr, mission: m });
  setProgress(0);
  await wait(500);
  status("Setting up the channel");
  await wait(600);
  await runTool({ name: "create_channel", icon: "youtube", args: `name: "${CHANNEL}", handle: ${HANDLE}, account: ${ACCOUNT}`, result: `created\nhandle: ${HANDLE}\nart: uploaded, 3 variants kept` }, { ms: 1300 });
  log("setup", `Channel created: ${CHANNEL} (${HANDLE})`);
  await say(`Channel open: **${CHANNEL}**, ${HANDLE}, under ${ACCOUNT}. The numbers and the log are on the right. Uploads go out at ${SLOTS.join(", ")}; starting on the first one.`);

  // ---------- scene 4: the first video, in full ----------

  think(true);
  status(THINKING.first[0]);
  await wait(1300);
  for (const [i, step] of FIRST_VIDEO.entries()) {
    if (THINKING.first[i]) status(THINKING.first[i]);
    await runTool(step.tool);
    if (step.shot) await shot(step.shot);
    if (step.note) {
      note(step.note);
      await wait(900);
    }
  }
  log("work", "Read the two inspiration channels and wrote script 1");
  await say("Script is 138 words and opens on the climber reaching for the hold. Generating the crag scene in three models to see which one looks real, then the voice.");
  status(THINKING.first[3]);
  for (const g of GENERATION) {
    await runTool(g.tool, { ms: 1400 });
    if (g.shot) await shot(g.shot, 900);
  }
  note(GENERATION_NOTE);
  log("insight", "Veo 3 keeps the hands and the rock right; Kling lets the feet drift", { delta: 19 });
  pushMissions(22);
  await wait(1000);
  status(THINKING.first[4]);
  await runTool(VOICE.tool, { ms: 1500 });
  await shot(VOICE.shot, 800);
  const voice = append(milestoneMarkup({ title: VOICE.milestone.title, text: VOICE.milestone.text, src: `${ASSETS}/${VOICE.milestone.src}`, icon: "mic" }));
  voice.insertAdjacentHTML("beforeend", `<span class="demo-wave" aria-hidden="true">${"<i></i>".repeat(18)}</span>`);
  append(`<div class="c-media demo-audio"><audio controls preload="metadata" src="${ASSETS}/${VOICE.milestone.src}"></audio></div>`);
  log("work", "Voiceover recorded, 14 s");
  await wait(1600);
  status(THINKING.first[5]);
  await runTool(RENDER, { ms: 1600 });
  const first = VIDEOS[0];
  const firstTitle = WEEK_TITLES[0];
  await runTool(UPLOAD(firstTitle), { ms: 1500 });
  const card1 = videoCard(first, firstTitle, SLOTS[0], "3:04");
  log("video", `Uploaded: ${firstTitle}, 3:04`);
  pushMissions(30);
  await say(`It is live: [${firstTitle}](${first.url}), scheduled for ${SLOTS[0]}. The 12:00 and 18:00 videos are already in the queue.`);
  status("Cutting the 12:00 short");

  // ---------- scene 5: the link, opened and closed ----------

  await wait(900);
  await player.click(card1);
  // the page is the generated clip when it is on disk, the real embed if not
  const generated = `${ASSETS}/${GENERATED.file}`;
  const hasClip = await fetch(generated, { method: "HEAD" }).then((r) => r.ok).catch(() => false);
  const back = await player.openBrowser({ url: first.url, video: hasClip ? generated : null, embed: `https://www.youtube-nocookie.com/embed/${first.id}?autoplay=1&mute=1&rel=0&modestbranding=1` });
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

  // ---------- scene 6: the second and third uploads ----------

  player.setSpeed(1.6);
  // from here the numbers move on their own clock
  startNumbers();
  for (const [i, v] of [VIDEOS[1], VIDEOS[2]].entries()) {
    const title = WEEK_TITLES[i + 1];
    const slot = SLOTS[i + 1];
    status(`Working on the ${slot} upload`);
    think(true);
    await wait(900);
    await runTool({ name: "generate_video", icon: "clapperboard", args: `model: ${i === 0 ? "Veo 3" : "Runway Gen-4"}, scenes: ${i === 0 ? 1 : 3}`, result: i === 0 ? "done in 36 s" : "done in 1:52" }, { ms: 1300 });
    await runTool({ name: "generate_voice", icon: "mic", args: `${i === 0 ? "38" : "155"} words`, result: `${i === 0 ? "9.1" : "41"} s` }, { ms: 900, result: false });
    await runTool(UPLOAD(title, slot), { ms: 1200 });
    videoCard(v, title, slot, i === 0 ? "0:45" : "4:12");
    log("video", `Uploaded: ${title}`);
    moveNumbers(0.04 + i * 0.04, 2400);
    pushMissions(18);
    await wait(700);
  }
  await say("Three up on day one. From here I run the tests: length, model and thumbnail, two arms at a time, and switch the queue to whatever wins.");
  await wait(1200);

  // ---------- scene 7: a week at five times speed, then faster ----------

  const speedLabel = (s) => `${s.toLocaleString("en-US", { maximumFractionDigits: 1 })}× speed`;
  head.insertAdjacentHTML("beforeend", `<span class="demo-speed" data-demo-speed>${icon("fast-forward")}<span data-demo-speed-label>${speedLabel(WEEK_SPEEDS[0])}</span></span>`);
  const badge = head.querySelector("[data-demo-speed]");
  popIn(badge);
  player.setSpeed(WEEK_SPEEDS[0]);
  let uploads = 3;
  let titleIndex = 3;
  // one day's beats, in the run's own milliseconds, before the speed
  // divides them: the numbers are given the same stretch to move in
  const DAY_MS = 900 + 2 * 1000 + 1100 + SLOTS.length * (700 + 500) + 700;
  for (const [n, d] of WEEK.entries()) {
    // the week picks up as it goes; the badge says so
    if (WEEK_SPEEDS[n] !== player.getSpeed()) {
      player.setSpeed(WEEK_SPEEDS[n]);
      const label = badge.querySelector("[data-demo-speed-label]");
      label.textContent = speedLabel(WEEK_SPEEDS[n]);
      rise(label, 3);
    }
    // where the numbers stand by the end of this day: barely moved over
    // the first days, then the curve turns up and the last of them run away
    const subsBefore = p().stats.subs;
    moveNumbers(0.1 + 0.8 * easeIn((n + 1) / WEEK.length), DAY_MS / player.getSpeed());
    day(d.day);
    status(`Day ${d.day}: reading yesterday's numbers`);
    await wait(900);
    for (const t of d.tools) await runTool(t, { ms: 1000 });
    note(d.note);
    log("insight", d.note.split(". ")[0], { delta: 12 + n * 9 });
    await wait(1100);
    for (const [k, slot] of SLOTS.entries()) {
      const v = VIDEOS[(uploads + k) % VIDEOS.length];
      const title = WEEK_TITLES[titleIndex % WEEK_TITLES.length];
      titleIndex += 1;
      status(`Day ${d.day}: the ${slot} upload`);
      await runTool(UPLOAD(title, slot), { ms: 700, result: false });
      videoCard(v, title, slot, k === 1 ? "0:45" : k === 0 ? "3:10" : "6:48");
      log("video", `Uploaded: ${title}`);
      await wait(500);
    }
    uploads += 3;
    // the log reads the tiles' own numbers, so the two never disagree
    const gained = p().stats.subs - subsBefore;
    if (gained > 0) log("subscriber", `${gained.toLocaleString("en-US")} new subscribers today`);
    log("view", `Day ${d.day}: ${p().users.at(-1).toLocaleString("en-US")} views so far`);
    pushMissions(26);
    await wait(700);
  }

  // ---------- scene 8: the numbers, and the cut ----------

  // no zoom and no report line: the week left the count climbing, it keeps
  // climbing here in real time, and the sign-off lands on top of it while
  // the tiles are still rolling — the run cuts from numbers actively
  // running up straight to the outro
  status("Reading the week's numbers");
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
  outro.innerHTML = `<img class="demo-outro__logo" src="${SHARED}/${OUTRO.logo}" alt="" width="512" height="512"><span class="demo-outro__name">${escapeHtml(OUTRO.name)}</span><button type="button" class="demo-outro__replay" data-demo-replay>${icon("rotate-ccw")}<span>Replay</span></button>`;
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
function preload() {
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
  for (const s of [...FIRST_VIDEO, ...GENERATION, VOICE]) if (s.shot) has(`${s.shot.shared ? SHARED : ASSETS}/${s.shot.file}`);
  for (const v of VIDEOS) has(`${ASSETS}/${v.thumb}`);
  return { has };
}
