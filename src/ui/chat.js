// chat.js: a project's agent at work, and the line you talk to it on. The
// agent's own turns land in the stream as they happen, one at a time: what
// it is about to do, the tools it calls and what they came back with, the
// line it says when it is done, and now and then a question with the
// options it offers. What it is on right now sits on the composer's top
// edge. Send a message and it reads the live numbers before it answers.
// Every turn is kept on the project, so the stream is still there when you
// come back.
import { MODELS } from "../data.js";
import { icon, STRIPE_MARK, YOUTUBE_MARK } from "../icons.js";
import { kindOf, planFor } from "../kinds.js";
import { MODES, agreePlan, busyBy, changePlan, claimDraft, connectorsPending, emit, get, isBusy, isRunning, project, projectMode, pushActivity, pushNotification, pushThread, setBusy, setPaused, setPlan, setProjectGoal, setProjectMode, setProjectModel, setupSteps, subscribe } from "../store.js";
import { EASE_OUT, EASE_STD, MOD, announce, escapeHtml, formatMoney, formatNum, linkParts, reduceMotion, richText, uid, wait } from "../util.js";
import { confirmDialog, mediaDialog, settle } from "./dialog.js";
import { renderSetup, setupDoneMarkup } from "./setup.js";
import { liveConnected, planLive, sendLive } from "../live.js";

const THREAD_LIMIT = 80;
// what you typed and did not send, per chat: it is back in the box when
// you return, and gone once it is sent
const unsent = new Map();
const FADE_WORD = [{ opacity: 0, filter: "blur(3px)" }, { opacity: 1, filter: "blur(0)" }];
const FADE_PLAIN = [{ opacity: 0 }, { opacity: 1 }];

export const TEXT_EFFECTS = {
  fade: { group: "Fade in", label: "Fade in", hint: "words, caret", unit: "word", ms: 40, frames: FADE_WORD, duration: 260, easing: EASE_OUT, caret: true },
  "fade-quiet": { group: "Fade in", label: "Fade in, quiet", hint: "words, no caret", unit: "word", ms: 40, frames: FADE_WORD, duration: 260, easing: EASE_OUT, caret: false },
  "fade-soft": { group: "Fade in", label: "Fade in, soft", hint: "slow, no blur", unit: "word", ms: 55, frames: FADE_PLAIN, duration: 420, easing: EASE_OUT, caret: false },
  "fade-letters": { group: "Fade in", label: "Fade letters", hint: "letters, caret", unit: "char", ms: 10, frames: FADE_PLAIN, duration: 180, easing: EASE_OUT, caret: true },
  typewriter: { group: "Other", label: "Typewriter", hint: "letter by letter", unit: "char", ms: 14, caret: true },
  drop: { group: "Other", label: "Drop in", hint: "words land", unit: "word", ms: 45, frames: [{ opacity: 0, transform: "translateY(-10px) scale(1.08)" }, { opacity: 1, transform: "translateY(0) scale(1)" }], duration: 220, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)", caret: true },
  rise: { group: "Other", label: "Rise", hint: "words slide up", unit: "word", ms: 40, frames: [{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "translateY(0)" }], duration: 200, easing: EASE_OUT, caret: true },
  unblur: { group: "Other", label: "Unblur", hint: "letters sharpen", unit: "char", ms: 16, frames: [{ opacity: 0.2, filter: "blur(6px)" }, { opacity: 1, filter: "blur(0)" }], duration: 320, easing: EASE_OUT, caret: true },
  instant: { group: "Other", label: "Instant", hint: "all at once", unit: "all", caret: false },
};

// the line arrives in the chosen effect; a newer reveal on the same
// element cancels the one in flight
let revealSeq = 0;
export async function revealText(el, text, scroll) {
  const effect = TEXT_EFFECTS[get().textEffect] || TEXT_EFFECTS["fade-letters"];
  const id = String((revealSeq += 1));
  el.dataset.reveal = id;
  el.classList.toggle("no-caret", effect.caret === false);
  el.textContent = "";
  const tick = () => scroll?.();
  if (reduceMotion() || effect.unit === "all") {
    el.innerHTML = richText(text);
    tick();
    return;
  }
  // a link in the line ([label](url)) arrives whole, as one unit, and
  // opens in a new tab like the rest of the thread's links
  const linkEl = (part) => {
    const a = document.createElement("a");
    a.className = "c-msg__link";
    a.href = part.url;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = part.label;
    return a;
  };
  const parts = linkParts(text);
  if (!effect.frames) {
    for (const part of parts) {
      if (part.url) {
        if (el.dataset.reveal !== id) return;
        el.append(linkEl(part));
        tick();
        await wait(effect.ms * 3);
        continue;
      }
      for (const ch of part.text) {
        if (el.dataset.reveal !== id) return;
        el.append(ch);
        tick();
        await wait(effect.ms + Math.random() * effect.ms * 0.6);
      }
    }
    return;
  }
  const tokens = parts.flatMap((part) => (part.url ? [part] : effect.unit === "word" ? part.text.split(/(\s+)/) : [...part.text]));
  for (const token of tokens) {
    if (el.dataset.reveal !== id) return;
    if (!token) continue;
    if (typeof token === "string" && /^\s+$/.test(token)) {
      el.append(token);
      continue;
    }
    let unit;
    if (typeof token === "string") {
      unit = document.createElement("span");
      unit.className = effect.unit === "word" ? "c-msg__word" : "c-msg__char";
      unit.textContent = token;
    } else {
      unit = linkEl(token);
      unit.classList.add("c-msg__word");
    }
    el.append(unit);
    unit.animate(effect.frames, { duration: effect.duration, easing: effect.easing, fill: "backwards" });
    tick();
    await wait(effect.ms);
  }
}

// ---------- markup ----------

// a milestone: one moment that matters, named with its evidence — a video
// uploaded (linked), a clip generated, a voiceover recorded
const milestoneMark = (name) => (name === "youtube" ? YOUTUBE_MARK : icon(name || "badge-check"));
// a milestone you can see through: one with a src (the clip, the
// voiceover) opens its media right in a dialog; one with a url (the
// video) links out to it
export const milestoneMarkup = (it) => {
  // the whole card is the artifact's door: a url makes the card a real link
  // (external artifact), a src makes it a player (local artifact) — no card
  // is ever a dead end the user can't click
  if (it.url) {
    return `<a class="c-milestone is-viewable" href="${escapeHtml(it.url)}" target="_blank" rel="noopener"><span class="c-milestone__mark">${milestoneMark(it.icon)}</span><span class="c-milestone__body"><span class="c-milestone__title">${escapeHtml(it.title)}</span>${it.text ? `<span class="c-milestone__text">${escapeHtml(it.text)}</span>` : ""}</span>${icon("arrow-up-right", "c-milestone__open")}</a>`;
  }
  return `<div class="c-milestone${it.src ? " is-viewable" : ""}"${it.src ? ` role="button" tabindex="0" data-view-src="${escapeHtml(it.src)}" data-view-title="${escapeHtml(it.title)}"` : ""}><span class="c-milestone__mark">${milestoneMark(it.icon)}</span><span class="c-milestone__body"><span class="c-milestone__title">${escapeHtml(it.title)}</span>${it.text ? `<span class="c-milestone__text">${escapeHtml(it.text)}</span>` : ""}</span>${it.src ? `${icon("play", "c-milestone__open")}` : ""}</div>`;
};

// a subagent thread item: spawned (its task) and finished (its result),
// named like a worker, tagged done or failed
const SUB_STATE = { running: { icon: "loader-circle", spin: true, label: "running" }, done: { icon: "check", label: "done" }, failed: { icon: "circle-alert", label: "failed" } };
const subagentMarkup = (it) => {
  const st = SUB_STATE[it.status] || SUB_STATE.running;
  // while it runs the body is the worker's live thought (what it is doing
  // right now, rotated by the server); the brief it was given shows as the
  // quiet fallback when no thought has landed yet
  const body = it.status === "running" && it.thought ? it.thought : it.text || "";
  return `<div class="app-submsg panel is-${st.label}" data-sub-card="${it.id || ""}">
  <div class="app-submsg__head">${icon("layout-grid")}<span class="app-submsg__name">${escapeHtml(it.name || "Subagent")}</span><span class="app-submsg__state">${st.spin ? icon(st.icon, "c-tool__spin") : icon(st.icon)}${st.label}${it.seconds !== undefined ? ` · ${it.seconds}s` : ""}</span></div>
  <span class="app-submsg__text">${richText(body)}</span>
</div>`;
};
// a sent file rides inside your line as a small chip, under the text or on
// its own when the line is only the file
const isImage = (name) => /\.(png|jpe?g|gif|webp)$/i.test(name);
const filesMarkup = (files = []) => (files.length ? `<span class="c-msg__files">${files.map((f) => `<span class="c-msg__file">${icon(isImage(f) ? "image" : "file-text")}${escapeHtml(f)}</span>`).join("")}</span>` : "");
export const msgMarkup = (who, rawText, reply, files) => {
  const text = String(rawText ?? "");
  return `<div class="c-msg c-msg--${who}${reply ? " c-msg--reply" : ""}${files?.length && !text ? " c-msg--files-only" : ""}">${who === "assistant" ? richText(text) : escapeHtml(text)}${who === "user" ? filesMarkup(files) : ""}</div>`;
};

// a question the agent asked in the stream: the options as buttons until
// one is picked, then the card folds to what was answered
const askMarkup = (a) => `<div class="app-ask panel${a.answered ? " is-answered" : ""}" data-ask-card="${a.id}">
  <span class="app-ask__q">${icon("circle-help")}<span>${escapeHtml(a.question)}</span></span>
  ${a.answered ? `<span class="app-ask__answer">${icon("check")}${escapeHtml(a.answer)}</span>` : `<span class="app-ask__options">${a.options.map((o) => `<button type="button" class="btn" data-ask-pick="${escapeHtml(o.label)}">${escapeHtml(o.label)}<span class="app-ask__note">${escapeHtml(o.note)}</span></button>`).join("")}</span>`}
</div>`;

// the plan the agent drafted from the first message: its steps, any change
// asked for since, and the button that agrees to it; agreed, it keeps the
// record and loses the button. A step is a title with its detail under it
// (a plan saved as plain lines still draws)
const planStepMarkup = (s) => (typeof s === "string" ? escapeHtml(s) : `<span class="app-plan__step">${escapeHtml(s.title)}</span><span class="app-plan__detail">${escapeHtml(s.detail)}</span>`);
export const planMarkup = (p) => {
  const plan = p.plan;
  if (!plan) return "";
  return `<div class="app-plan panel${plan.agreed ? " is-agreed" : ""}" data-plan-card>
  <div class="app-plan__head">${icon("compass")}<span class="app-plan__title">The plan</span>${plan.agreed ? `<span class="app-plan__state">${icon("check")}Agreed</span>` : ""}</div>
  <ol class="app-plan__steps">${plan.steps.map((s) => `<li>${planStepMarkup(s)}</li>`).join("")}${plan.changes.map((c) => `<li class="app-plan__change">${escapeHtml(c)}</li>`).join("")}</ol>
  ${plan.agreed ? `<div class="app-plan__foot"><span class="app-plan__approved">${icon("check")}Approved</span></div>` : `<div class="app-plan__foot"><button type="button" class="btn" data-plan-agree>Looks good, go ahead</button><span class="app-plan__hint">Or tell me what to change</span></div>`}
</div>`;
};
// a message that is only a yes agrees to the plan; anything more is a change
const APPROVAL_WORD = "(?:(?:that |it |this )?(?:looks|sounds) (?:good|great|fine|right)(?: to me)?|go ahead|do it|ship it|yes|yep|yeah|y|ok|okay|sure|fine|good|great|perfect|approved?|agreed?|let'?s go|start|go)";
// one phrase or a run of them: "Looks good, go ahead" is still a yes
const APPROVAL = new RegExp(`^(?:${APPROVAL_WORD}[\\s!.,]*)+$`, "i");

// the kept turns, grouped the way they were made: the agent's thinking and
// tool cards as one turn, then what it said, then a card or your answer
// the project whose thread is being drawn, for the cards that read the
// project rather than the item
let currentPlanId = null;
// connectable actions, one place: a probe names the step the verifier can
// check, the map says where the step happens, and a matching action docks a
// popup over the composer; actions without a probe keep the plain card
// each probe names the platform, its mark and where the step happens; the
// popup renders every platform the same way: mark, "Connect <Platform> Account",
// Connect. YouTube is never one: its path is the signed-in browser profile
const CONNECT_ACTIONS = {
  stripe_connect: { platform: "Stripe", mark: STRIPE_MARK, url: "https://dashboard.stripe.com/apikeys" },
  // Connect opens the app's own sign-in view (a headless profile on Google's
  // sign-in) so the scan/tap lands where the session actually lives
  youtube_session: { platform: "YouTube", mark: YOUTUBE_MARK, url: "/api/youtube/signin" },
};
const connectableAction = (it) => {
  if (it.kind !== "action" || it.done || !it.probe) return null;
  const known = CONNECT_ACTIONS[it.probe] || {};
  const url = it.url || known.url;
  if (!url) return null;
  const platform = it.platform || known.platform || "";
  return { url, platform, mark: known.mark || icon("external-link"), title: platform ? `Connect ${platform} Account` : it.title || "Connect account" };
};
const actionKey = (it) => `${it.at || 0}:${it.title || ""}`;
// actions settled this session (verified, done by hand or dismissed) never pop again
const settledActions = new Set();

// the thread never carries an "action needed" card of any kind: the popup
// docked over the composer is the one and only place a step of yours is
// asked for, and the rail row's orange count is the one and only notification

// a worker's media lands in the stream as playable artifacts: the user hears
// the audio it made and sees the screenshots it took
// an operator turn: the machine's own instruction, labeled so it never
// reads as the user's words
const operatorMarkup = (it) => `<div class="c-note"><strong>Operator:</strong> ${escapeHtml(String(it.text || "").replace(/\*\*/g, "").replace(/^#+ /gm, ""))}</div>`;

const mediaMarkup = (it) => {
  const src = `/ws/${currentPlanId}/${it.file.split("/").map(encodeURIComponent).join("/")}`;
  if (it.media === "video") return `<div class="c-media"><video controls preload="metadata" src="${src}"></video></div>`;
  if (it.media === "audio") return `<div class="c-media"><audio controls preload="metadata" src="${src}"></audio></div>`;
  return `<div class="c-media"><img loading="lazy" src="${src}" alt="${escapeHtml(it.title || "generated image")}"></div>`;
};

function threadMarkup(items) {
  let out = "";
  let turn = "";
  const flush = () => {
    if (turn) out += `<div class="c-turn">${turn}</div>`;
    turn = "";
  };
  // a worker's two rows (spawned, then finished) arrive under one id: only
  // the last state of each id draws, so a finished mission shows one card
  // per worker rather than a spinning one beside its own result. A row with
  // no id cannot be paired and always draws.
  const lastSub = new Map();
  items.forEach((it, n) => {
    if (it.kind === "subagent" && it.id) lastSub.set(it.id, n);
  });
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.kind === "thought") continue; // thinking never draws in the stream; it rotates on the composer strip
    if (it.kind === "tool") {
      // tool lines stay off the stream too: the strip above the composer says what is running
      while (items[i + 1]?.kind === "tool") i++;
      continue;
    }
    else if (it.kind === "milestone") {
      flush();
      out += milestoneMarkup(it);
    }
    else if (it.kind === "action") {
      // nothing in the thread: the composer popup is the only surface
      continue;
    }
    else if (it.kind === "media") {
      flush();
      out += mediaMarkup(it);
    }
    else {
      flush();
      // an open question lives in the form above the composer, not here;
      // once answered it folds into the thread as a record
      if (it.kind === "ask") out += it.answered ? askMarkup(it) : "";
      else if (it.kind === "plan") out += planMarkup(project(currentPlanId));
      else if (it.kind === "subagent") {
        if (!it.id || lastSub.get(it.id) === i) out += subagentMarkup(it);
      }
      else if (it.kind === "setup") out += `<div class="app-thread__setup" data-setup-slot></div>`;
      else if (it.operator) out += operatorMarkup(it); // the machine's own turn, never a user bubble
      else out += msgMarkup(it.kind === "assistant" ? "assistant" : "user", it.text, it.kind === "reply", it.files);
    }
  }
  flush();
  return out;
}


const modelMenu = () => `<div class="c-menu panel" role="menu" aria-label="Model" hidden>${MODELS.map((m) => `<button type="button" class="c-menu__item" role="menuitem" data-value="${m.name}"><span class="c-menu__text">${m.name}</span><span class="c-menu__hint">${m.note}, ${m.ctx}</span></button>`).join("")}</div>`;
// Ask or Yolo, beside the model: how much the agent stops to ask
const modeOf = (p) => MODES.find((m) => m.id === projectMode(p));
const modeChip = (p) => `${icon(modeOf(p).icon)}<span data-mode-label>${modeOf(p).label}</span>`;
const modeMenu = (p) => `<div class="c-menu panel" role="menu" aria-label="Permission" hidden>${MODES.map((m) => `<button type="button" class="c-menu__item" role="menuitemradio" aria-checked="${m.id === projectMode(p)}" data-mode="${m.id}">${icon(m.icon)}<span class="c-menu__text">${m.label}</span><span class="c-menu__hint">${m.hint}</span></button>`).join("")}</div>`;

// what the box asks for: the brief while a project is a draft or in setup,
// feedback once it is running
// while the plan is on the table the box asks about it; before that, what
// to build; once the project runs, feedback
const placeholderFor = (p) => (p.plan && p.plan.steps?.length && !p.plan.agreed ? "Any changes to the plan?" : isRunning(p) ? "Give Feedback" : "What should we build?");

// the composer: what the agent is on sits on its top edge, always; the
// field and its row under it
const composerMarkup = (p) => `<form class="c-composer panel app-composer" data-composer>
  <div class="c-action c-action--pop" data-action-pop hidden></div>
  <div class="c-ask" data-ask role="group" aria-labelledby="ask-q" hidden></div>
  <div class="c-composer__status app-now${p.paused ? " is-paused" : ""}" data-status${p.liveStatus ? "" : " hidden"}><span class="app-now__icon" data-status-icon>${p.paused ? icon("pause") : icon("loader-circle", "c-tool__spin")}</span><span class="app-now__label" data-status-label></span><span class="c-composer__status-text app-now__text" data-status-text>${escapeHtml(p.liveStatus || (p.thoughts && p.thoughts[p.step]) || "")}</span><button type="button" class="btn btn--quiet app-now__pause" data-pause-toggle>${p.paused ? `${icon("play")}<span>Resume</span>` : `${icon("pause")}<span>Pause</span>`}</button></div>
  <div class="c-composer__chips" data-chips></div>
  <textarea class="c-composer__input c-composer__area" rows="1" placeholder="${placeholderFor(p)}" aria-label="Message"></textarea>
  <div class="c-composer__row"><button type="button" class="btn btn--icon btn--quiet" aria-label="Attach a file" data-attach>${icon("paperclip")}</button><input type="file" class="sr-only" data-file multiple tabindex="-1"><span class="c-composer__spacer"></span><span class="c-dd"><button type="button" class="c-composer__chip pick-plain app-mode" data-menu data-mode-chip aria-haspopup="menu" aria-expanded="false" aria-label="Permission mode">${modeChip(p)}${icon("chevron-down")}</button>${modeMenu(p)}</span><span class="c-dd"><button type="button" class="c-composer__chip pick-plain" data-menu aria-haspopup="menu" aria-expanded="false"><span data-menu-label>${escapeHtml(p.model)}</span>${icon("chevron-down")}</button>${modelMenu()}</span><button type="button" class="btn btn--icon btn--quiet" aria-label="Dictate" data-mic aria-pressed="false"><span class="btn__swap"><svg class="icon-16 btn__swap-mic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19v3m7-12v2a7 7 0 0 1-14 0v-2"/><rect width="6" height="13" x="9" y="2" rx="3"/></svg><svg class="icon-16 btn__swap-wave" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect class="btn__wave-bar" x="4" y="9" width="3" height="6" rx="1.5"/><rect class="btn__wave-bar" x="10.5" y="5" width="3" height="14" rx="1.5"/><rect class="btn__wave-bar" x="17" y="9" width="3" height="6" rx="1.5"/></svg></span></button><button type="submit" class="btn btn--icon btn--send" aria-label="Send" data-send disabled>${icon("arrow-up")}</button></div>
</form>`;

// ---------- the tools the agent calls when you ask ----------

const users30 = (p) => {
  const i = p.users.length - 1;
  return p.history[i] ? (((p.users[i] - p.history[i]) / p.history[i]) * 100).toFixed(1) : null;
};

const TOOLS = {
  read_revenue: { label: "Reading monthly revenue", args: "tile: monthly_revenue", run: (p) => `revenue: ${formatMoney(p.revenue)}\nbaseline: ${formatMoney(p.baseline)}\nchange: ${p.baseline ? `${p.revenue >= p.baseline ? "+" : "-"}${Math.abs(((p.revenue - p.baseline) / p.baseline) * 100).toFixed(1)}% on last month` : "no baseline yet"}\nad spend: ${formatMoney(p.adSpend)}` },
  read_users: { label: "Reading the series", args: "series: last 14 days", run: (p) => `latest: ${formatNum(p.users.at(-1))}\nfirst: ${formatNum(p.users[0])}\n30-day change: ${users30(p) === null ? "n/a" : `+${users30(p)}%`}` },
  list_insights: { label: "Listing insights", args: "type: breakthrough, limit: 2", run: (p) => p.insights.filter((i) => i.type === "breakthrough").slice(0, 2).map((i) => `- ${i.title} (${i.delta > 0 ? "+" : ""}${i.delta}%)`).join("\n") || "- none yet" },
  read_setup: { label: "Reading the setup checklist", args: "steps: 3", run: (p) => setupSteps.map((s) => `- ${s}: ${p.setup.done.includes(s) ? `done, ${p.setup.summary[s]}` : "open"}`).join("\n") },
};


const thinkingFor = (p, text) => {
  const short = text.length > 60 ? `${text.slice(0, 60)}…` : text;
  if (!isRunning(p)) return `The user asked: "${short}"\n\n${p.name} is not set up yet: the checklist beside this chat still has ${setupSteps.length - p.setup.done.length} open step${setupSteps.length - p.setup.done.length === 1 ? "" : "s"}, so there are no live numbers to read. I should read the checklist and ask which step to take first rather than guess.`;
  return `The user asked: "${short}"\n\nThe tiles beside this chat hold live numbers, so I should read those instead of guessing. The window is not stated: the graph shows 14 days and the badge compares 30, so I will ask which one before summarising.`;
};

// ---------- the chat ----------

export function renderChat(root, projectId) {
  const p = () => project(projectId);
  const kind = kindOf(p().kind);
  let pendingAnswer = null;
  currentPlanId = projectId;
  root.innerHTML = `<div class="c-chat app-chat" data-chat>
  <header class="app-chat__head"><span class="app-chat__title" data-chat-title>${escapeHtml(p().name)}</span><span class="app-chat__paused" data-chat-paused${p().paused ? "" : " hidden"}>Paused</span></header>
  <div class="app-thread-wrap"><div class="c-thread app-thread" data-thread role="log" aria-label="Conversation" aria-live="polite">${threadMarkup(p().thread)}</div></div>
  <button type="button" class="btn c-chat__reopen" data-ask-reopen hidden>Reopen form${icon("chevron-down", "c-chat__reopen-chev")}</button>
  ${composerMarkup(p())}
</div>`;
  const chat = root.querySelector("[data-chat]");
  const thread = chat.querySelector("[data-thread]");
  const form = chat.querySelector("[data-composer]");
  const input = form.querySelector(".c-composer__input");
  // the thread follows new lines only while you are at its foot: scrolling
  // up unpins it and it holds still however much lands below; scrolling
  // back to the foot (or sending a message) pins it again
  let pinned = true;
  // the height the thread had when it was last placed at its foot: new
  // lines grow it, and only growth explains a pinned thread sitting above
  // the foot. Anything beyond that is you scrolling up, caught even before
  // the browser gets to fire the scroll event (a typed word lands every few
  // ms, sooner than that event)
  let known = 0;
  const gap = () => thread.scrollHeight - thread.scrollTop - thread.clientHeight;
  // a thread that overflows by less than a line is really its foot padding
  // and a sliver: it reads from the top rather than hiding the first line
  // under the head, and pins to the foot once there is more to scroll
  const SLACK = 24;
  const slack = () => thread.scrollHeight - thread.clientHeight < SLACK;
  // whether the last placement left the thread at its top on purpose: that
  // slack is then not you scrolling up when the next line lands
  let atTop = false;
  const toFoot = () => {
    atTop = slack();
    thread.scrollTop = atTop ? 0 : thread.scrollHeight;
    known = thread.scrollHeight;
  };
  const scroll = () => {
    pinned = true;
    toFoot();
  };
  const follow = () => {
    if (!pinned) return;
    if (!slack() && gap() > Math.max(0, thread.scrollHeight - known) + 12 + (atTop ? SLACK : 0)) {
      pinned = false;
      return;
    }
    toFoot();
  };
  thread.addEventListener(
    "scroll",
    () => {
      pinned = gap() < 12 || slack();
      if (pinned) known = thread.scrollHeight;
    },
    { passive: true },
  );
  const prune = () => {
    while (thread.children.length > THREAD_LIMIT) thread.firstElementChild.remove();
  };
  requestAnimationFrame(scroll);

  // the head is the title alone now; nothing to repaint when an ask lands
  function paintPill() {}

  function composerInput() {
    const send = form.querySelector("[data-send]");
    // a message can always go: one sent mid-answer lands at once and is
    // answered next
    const ready = Boolean(input.value.trim()) || form.querySelector("[data-chips] .c-chip") !== null;
    send.disabled = !ready;
    form.classList.toggle("is-ready", ready);
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
  }

  // force: your own message always brings the foot into view
  function append(html, { force = false } = {}) {
    thread.insertAdjacentHTML("beforeend", html);
    prune();
    if (force) scroll();
    else follow();
    return thread.lastElementChild;
  }

  // the strip on the composer's top edge: the agent's plain-English line,
  // refreshed from the server every few seconds while it works
  function setNow(text, label = "") {
    const strip = form.querySelector("[data-status]");
    const el = form.querySelector("[data-status-text]");
    if (!text) { strip.hidden = true; return; }
    strip.hidden = false;
    form.querySelector("[data-status-label]").textContent = label;
    if (el.textContent === text) return;
    el.textContent = text;
    if (!reduceMotion()) el.animate([{ opacity: 0, transform: "translateY(3px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 200, easing: EASE_OUT });
  }
  const setStatus = (text) => setNow(text, "");

  // the strip's thoughts: the lines the agent thinks land here instead of
  // the stream, and while it works the strip rotates one onto its face
  // every 2-6 seconds
  const thoughtPool = [];
  const noteThought = (text) => {
    if (!text) return;
    thoughtPool.push(String(text));
    if (thoughtPool.length > 6) thoughtPool.shift();
  };
  let rotateTimer = 0;
  const thinkingNow = () => !p().paused && (isRunning(p()) || busyBy(projectId) === "agent" || (p().missions || []).some((m) => m.status === "running"));
  const rotateThought = () => {
    if (!root.isConnected || form.dataset.busy || !thinkingNow()) return;
    const pool = [...thoughtPool, ...(p().thoughts || [])].filter(Boolean);
    if (!pool.length) return;
    const current = form.querySelector("[data-status-text]")?.textContent || "";
    const rest = pool.filter((t) => t !== current);
    const picks = rest.length ? rest : pool;
    setNow(picks[Math.floor(Math.random() * picks.length)]);
  };
  const armThoughtRotate = () => {
    if (rotateTimer) return;
    rotateTimer = setTimeout(() => {
      rotateTimer = 0;
      if (!root.isConnected) return;
      rotateThought();
      armThoughtRotate();
    }, 2000 + Math.random() * 4000);
  };
  const hasSetupCard = () => p().thread.some((t) => t.kind === "setup");
  // at rest the strip carries the agent's line; a project not yet set up
  // has no line to carry, so the strip is not drawn at all
  // the strip's Pause exists only where there is work to hold: busy now, a
  // mission running, or already paused (so Resume is always reachable)
  const working = () => p().paused || busyBy(projectId) === "agent" || (p().missions || []).some((m) => m.status === "running");
  const paintPauseButton = () => {
    const b = form.querySelector("[data-pause-toggle]");
    if (b) b.hidden = !working();
  };

  // the paused state, everywhere it shows: the pill by the title, the
  // strip's icon and shimmer, and the button that reads Pause or Resume
  const paintPaused = () => {
    const paused = p().paused;
    chat.querySelector("[data-chat-paused]").hidden = !paused;
    const strip = form.querySelector("[data-status]");
    strip.classList.toggle("is-paused", paused);
    strip.querySelector("[data-status-icon]").innerHTML = paused ? icon("pause") : icon("loader-circle", "c-tool__spin");
    strip.querySelector("[data-pause-toggle]").innerHTML = paused ? `${icon("play")}<span>Resume</span>` : `${icon("pause")}<span>Pause</span>`;
    paintPauseButton();
  };

  // ---------- pausing: only you can pause it, Pause asks first, Resume is one press ----------

  async function togglePause() {
    if (p().paused) {
      setPaused(projectId, false);
      paintPaused();
      restNow();
      announce("Work resumed");
      const say = "Back on it. Picking up where the tasks left off.";
      pushThread(projectId, { kind: "assistant", text: say }, { own: true });
      enqueue({ kind: "assistant", text: say });
      return;
    }
    const ok = await confirmDialog({ title: `Pause work on ${p().name}?`, text: "You can resume at any time, this pauses the agent's thinking.", action: "Pause work" });
    if (!ok || !root.isConnected) return;
    await settle();
    setPaused(projectId, true);
    paintPaused();
    restNow();
    announce("Work paused");
    const say = "Paused. The tasks hold where they are and I stop between steps. Press Resume whenever you want me back on it.";
    pushThread(projectId, { kind: "assistant", text: say }, { own: true });
    enqueue({ kind: "assistant", text: say });
  }

  const restNow = () => {
    paintPauseButton();
    if (p().paused) return setNow("Work holds where it is. Resume picks it back up.", "Paused");
    if (isRunning(p())) return setNow((p().thoughts && p().thoughts[p().step]) || p().liveStatus || "");
    form.querySelector("[data-status]").hidden = true;
  };
  // the thinking marker: a plain, unclickable "Thinking..." with a spinner
  // at the stream's bottom edge while the agent works — the real thoughts
  // still attach beneath it as they land
  let thinkRow = null;
  const showThinking = () => {
    if (thinkRow?.isConnected) return;
    const thread = chat.querySelector("[data-thread]");
    if (!thread) return;
    thinkRow = document.createElement("div");
    thinkRow.className = "c-turn";
    thinkRow.innerHTML = `<div class="c-thinking">${icon("loader-circle", "btn__spinner")}<span>Thinking...</span></div>`;
    thread.append(thinkRow);
    follow();
  };
  const removeThinking = () => {
    if (thinkRow?.isConnected) thinkRow.remove();
    thinkRow = null;
  };

  // the edge fades only where lines actually run under an edge: the foot
  // once the thread overflows, the top once it has been scrolled
  function paintEdges() {
    thread.classList.toggle("is-overflowing", thread.scrollHeight > thread.clientHeight + 1);
    thread.classList.toggle("is-scrolled", thread.scrollTop > 4);
  }
  thread.addEventListener("scroll", paintEdges, { passive: true });
  // the thread's frame changes height when the composer grows or shrinks
  // (an attachment chip, a taller message): pinned at its foot, it stays
  // at its foot, so the last lines never slide under the composer
  let frameHeight = thread.clientHeight;
  const edges = new ResizeObserver(() => {
    if (thread.clientHeight !== frameHeight) {
      frameHeight = thread.clientHeight;
      if (pinned) scroll();
    }
    paintEdges();
  });
  edges.observe(thread);
  const edgeWatch = new MutationObserver(paintEdges);
  edgeWatch.observe(thread, { childList: true, subtree: true, characterData: true });

  // the setup checklist lives in the thread: live while the project is
  // being set up, folded to what it recorded once it is done
  let setupCleanup = () => {};
  function mountSetups() {
    setupCleanup();
    setupCleanup = () => {};
    const slots = [...thread.querySelectorAll("[data-setup-slot]")];
    for (const slot of slots) {
      if (isRunning(p()) || slot !== slots.at(-1)) slot.innerHTML = setupDoneMarkup(p());
      else setupCleanup = renderSetup(slot, projectId);
    }
  }

  // ---------- the agent's own turns, arriving from the store ----------

  // one thing types at a time: every incoming item waits for the one before
  let queue = Promise.resolve();
  let liveTurn = null;
  async function incoming(item) {
    if (!root.isConnected) return;
    if (item.kind === "thought") {
      // the stream stays quiet: a thought joins the composer strip's rotation
      noteThought(item.text);
      return;
    } else if (item.kind === "tool") {
      // tools stay off the stream; the strip above the composer still says what is running
      if (!form.dataset.busy) setNow(`Running ${item.name}`);
      return;
    } else if (item.kind === "milestone") {
      liveTurn = null;
      const card = append(milestoneMarkup(item), { force: true });
      follow();
      if (!reduceMotion()) card.animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 240, easing: EASE_OUT });
      return;
    } else if (item.kind === "action") {
      liveTurn = null;
      paintActionPop();
      return;
    } else if (item.kind === "media") {
      liveTurn = null;
      removeThinking();
      const card = append(mediaMarkup(item), { force: true });
      follow();
      if (!reduceMotion()) card.animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 240, easing: EASE_OUT });
      return;
    } else if (item.kind === "assistant") {
      liveTurn = null;
      removeThinking();
      const msg = append(msgMarkup("assistant", ""));
      msg.classList.add("is-live");
      await revealText(msg, item.text, follow);
      msg.classList.remove("is-live");
      return;
    } else if (item.kind === "ask") {
      liveTurn = null;
      openAsk(item);
      paintPill();
      return;
    } else if (item.kind === "setup") {
      liveTurn = null;
      const slot = append(`<div class="app-thread__setup" data-setup-slot></div>`);
      mountSetups();
      if (!reduceMotion()) slot.animate([{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 240, easing: EASE_OUT });
      follow();
      return;
    } else if (item.kind === "plan") {
      const card = append(planMarkup(p()), { force: true });
      if (!reduceMotion()) card.animate([{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 240, easing: EASE_OUT });
      follow();
      return;
    } else if (item.kind === "subagent") {
      liveTurn = null;
      // a worker's two rows (spawned, then finished) share its id: the
      // second replaces the first card in place rather than stacking a
      // second one, so a worker never spins forever beside its own result.
      // A row with no id cannot be paired and still appends.
      const prev = item.id ? [...thread.querySelectorAll("[data-sub-card]")].find((el) => el.dataset.subCard === item.id) : null;
      if (prev) prev.outerHTML = subagentMarkup(item);
      else append(subagentMarkup(item), { force: true });
      const card = (item.id ? [...thread.querySelectorAll("[data-sub-card]")].find((el) => el.dataset.subCard === item.id) : null) || thread.lastElementChild;
      if (!reduceMotion()) card.animate([{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 240, easing: EASE_OUT });
      follow();
      return;
    } else if (item.operator) {
      // an operator turn: a labeled system line, never a bubble that reads
      // as the user's words
      liveTurn = null;
      removeThinking();
      append(operatorMarkup(item), { force: true });
      follow();
      return;
    } else {
      append(msgMarkup("user", item.text, item.kind === "reply", item.files));
      return;
    }
    prune();
    follow();
  }
  const enqueue = (item) => (queue = queue.then(() => incoming(item)).catch((err) => console.error(err)));

  // answering a card: the pick folds into the card, the agent says what it
  // will do, and the project's orange count clears
  // the answer, or a skip, folds the question into the thread as a record
  // and the agent says what it makes of it
  async function answerAsk(item, label) {
    if (!item || item.answered) return;
    const skipped = label === null;
    item.answered = true;
    item.answer = skipped ? "Skipped" : label;
    p().needs = 0;
    const old = thread.querySelector(`[data-ask-card="${item.id}"]`);
    if (old) old.outerHTML = askMarkup(item);
    else append(askMarkup(item), { force: true });
    paintPill();
    if (skipped) pushActivity(projectId, "user", "You skipped a question");
    else {
      pushThread(projectId, { kind: "reply", text: label }, { own: true });
      pushActivity(projectId, "user", `You answered: ${label}`);
      announce(`Answered: ${label}`);
    }
    await wait(700);
    if (liveConnected()) {
      // the backend says what it makes of the answer
      liveRun(skipped ? "The agent skipped that question" : label);
      return;
    }
    const say = skipped ? "No answer, so I am going with my own judgement on that one." : `Noted: ${label.charAt(0).toLowerCase()}${label.slice(1)}. Going ahead with that.`;
    pushThread(projectId, { kind: "assistant", text: say }, { own: true });
    enqueue({ kind: "assistant", text: say });
  }

  // a question from the agent takes the form above the composer, the same
  // one the setup conversation uses; one at a time
  let askOpen = null;
  function openAsk(item) {
    if (askOpen || item.answered) return;
    askOpen = item;
    askQuestion({ question: item.question, options: item.options }, { skippable: true }).then((answer) => {
      askOpen = null;
      answerAsk(item, answer);
    });
  }

  // ---------- your own run ----------

  async function runTool(name) {
    const tool = TOOLS[name];
    setStatus(tool.label);
    await wait(reduceMotion() ? 150 : 500 + Math.random() * 500);
    const result = tool.run(p());
    pushThread(projectId, { kind: "tool", name, args: tool.args, result }, { own: true });
    return result;
  }

  const grow = (ask) => {
    ask.hidden = false;
    if (reduceMotion()) return Promise.resolve();
    const height = ask.offsetHeight;
    ask.style.overflow = "hidden";
    return ask.animate([{ height: "0px", opacity: 0, paddingTop: "0px", paddingBottom: "0px" }, { height: `${height}px`, opacity: 1 }], { duration: 220, easing: EASE_OUT }).finished.then(() => (ask.style.overflow = ""));
  };
  const shrink = (ask) => {
    if (reduceMotion()) {
      ask.hidden = true;
      return Promise.resolve();
    }
    const height = ask.offsetHeight;
    ask.style.overflow = "hidden";
    return ask.animate([{ height: `${height}px`, opacity: 1 }, { height: "0px", opacity: 0, paddingTop: "0px", paddingBottom: "0px" }], { duration: 180, easing: EASE_STD }).finished.then(() => {
      ask.style.overflow = "";
      ask.hidden = true;
    });
  };

  // the question takes over the composer frame; a digit selects its row,
  // arrows move, Enter selects, Cmd/Ctrl+Enter submits, Escape folds it away
  function askQuestion(spec, { skippable = false } = {}) {
    const ask = form.querySelector("[data-ask]");
    const reopen = chat.querySelector("[data-ask-reopen]");
    const OTHER = "__other__";
    const rows = [...spec.options, { label: "Other", note: "Answer in your own words", value: OTHER }]
      .map((o, i) => `<button type="button" class="c-ask__option" role="radio" aria-checked="false" data-ask-value="${escapeHtml(o.value || o.label)}"><span class="c-ask__num" aria-hidden="true">${i + 1}</span><span class="c-ask__text"><span class="c-ask__label">${escapeHtml(o.label)}</span><span class="c-ask__note">${escapeHtml(o.note || "")}</span></span></button>`)
      .join("");
    // a question the agent can do without carries Skip; the setup's own
    // questions want an answer, so they carry Submit
    const foot = skippable ? `<button type="button" class="btn" data-ask-skip>Skip<kbd class="c-ask__kbd">${MOD} Enter</kbd></button>` : `<button type="button" class="btn" data-ask-submit>Submit<kbd class="c-ask__kbd">${MOD} Enter</kbd></button>`;
    ask.innerHTML = `<div class="c-ask__head"><span class="c-ask__q" id="ask-q">${escapeHtml(spec.question)}</span><button type="button" class="btn btn--icon btn--quiet c-ask__toggle" data-ask-toggle aria-label="Close the form">${icon("chevron-down")}</button></div><div class="c-ask__options" role="radiogroup" aria-label="Options">${rows}</div><div class="c-ask__other" data-ask-otherrow hidden><input class="c-ask__input" type="text" placeholder="Answer in your own words" aria-label="Your own answer" data-ask-input></div><div class="c-ask__foot">${foot}</div>`;
    chat.classList.add("is-asking");
    form.classList.add("is-asking");
    pushNotification("needs", `${p().name} asks: ${spec.question}`, { projectId });
    const options = [...ask.querySelectorAll("[data-ask-value]")];
    let selected = options[0];
    const select = (row) => {
      selected = row;
      for (const o of options) {
        o.setAttribute("aria-checked", String(o === row));
        o.classList.toggle("is-selected", o === row);
      }
      const other = ask.querySelector("[data-ask-otherrow]");
      other.hidden = row.dataset.askValue !== OTHER;
      if (!other.hidden) other.querySelector("[data-ask-input]").focus({ preventScroll: true });
    };
    select(selected);
    grow(ask).then(() => selected.focus({ preventScroll: true }));
    return new Promise((resolve) => {
      const finish = async (answer) => {
        pendingAnswer = null;
        ask.removeEventListener("click", onClick);
        ask.removeEventListener("keydown", onKey);
        reopen.removeEventListener("click", onReopen);
        reopen.hidden = true;
        if (form.classList.contains("is-asking")) await shrink(ask);
        else ask.hidden = true;
        form.classList.remove("is-asking");
        ask.innerHTML = "";
        chat.classList.remove("is-asking");
        composerInput();
        input.focus({ preventScroll: true });
        resolve(answer);
      };
      pendingAnswer = finish;
      const submit = () => {
        if (selected.dataset.askValue !== OTHER) return finish(selected.dataset.askValue);
        const own = ask.querySelector("[data-ask-input]").value.trim();
        if (own) return finish(own);
        ask.querySelector("[data-ask-input]").focus();
      };
      const close = async () => {
        form.classList.remove("is-asking");
        await shrink(ask);
        reopen.hidden = false;
        chat.classList.remove("is-asking");
        composerInput();
        input.focus({ preventScroll: true });
      };
      const onReopen = async () => {
        reopen.hidden = true;
        chat.classList.add("is-asking");
        form.classList.add("is-asking");
        await grow(ask);
        selected.focus({ preventScroll: true });
      };
      const onClick = (e) => {
        const row = e.target.closest("[data-ask-value]");
        if (row) return row === selected && row.dataset.askValue !== OTHER ? submit() : select(row);
        if (e.target.closest("[data-ask-submit]")) return submit();
        if (e.target.closest("[data-ask-skip]")) return finish(null);
        if (e.target.closest("[data-ask-toggle]")) return close();
      };
      const onKey = (e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          return skippable ? finish(null) : submit();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          return close();
        }
        if (e.target.matches("[data-ask-input]")) {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          } else if (/^[1-9]$/.test(e.key) && !e.target.value) {
            // the box is empty, so a digit still picks a row rather than
            // landing in it as text
            const i = Number(e.key) - 1;
            if (i < options.length && options[i].dataset.askValue !== OTHER) {
              e.preventDefault();
              select(options[i]);
              options[i].focus();
            }
          }
          return;
        }
        if (/^[1-9]$/.test(e.key)) {
          const i = Number(e.key) - 1;
          if (i < options.length) {
            e.preventDefault();
            select(options[i]);
            if (options[i].dataset.askValue !== OTHER) options[i].focus();
          }
          return;
        }
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          const i = options.indexOf(document.activeElement);
          if (i === -1) return;
          e.preventDefault();
          options[(i + (e.key === "ArrowDown" ? 1 : options.length - 1)) % options.length].focus();
        }
      };
      ask.addEventListener("click", onClick);
      ask.addEventListener("keydown", onKey);
      reopen.addEventListener("click", onReopen);
    });
  }

  // ---------- the connect popup: a connectable action docks over the input ----------

  const pop = form.querySelector("[data-action-pop]");
  const VERIFY_MS = 3000;
  const VERIFY_GIVE_UP = 5 * 60 * 1000;
  const VERIFY_UNREACHED = "Could not reach the verifier";
  const VERIFY_WAITING = "Not verified yet. Finish in the tab, then Connect again.";
  let popItem = null;
  let popPhase = "connect";
  let popReason = "";
  let popWatching = false;
  let popTimer = 0;
  let settleTimer = 0;
  let popSince = 0;
  let popEpoch = 0;

  // the newest unresolved connectable action, unless the user settled it
  function pickAction() {
    const items = p().thread || [];
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      if (settledActions.has(actionKey(it))) continue;
      const connect = connectableAction(it);
      if (!connect) continue;
      return { item: it, ...connect };
    }
    return null;
  }

  // the row is built once per action (mark, title, button); a phase change
  // only swaps the button's label and state, so the swap can animate and
  // the mark and title never re-render mid-transition
  let popKey = "";
  const POP_BUTTON = {
    connect: () => `<span class="c-action__label">Connect</span>`,
    retry: () => `<span class="c-action__label">Try again</span>`,
    verifying: () => `${icon("loader-circle", "c-tool__spin")}<span class="c-action__label">Verifying</span>`,
    connected: () => `${icon("check", "c-action__check")}<span class="c-action__label">Connected</span>`,
  };
  // connectors still to be solved, watched so the rail's orange count and the
  // home tiles hear the moment one lands or settles
  let lastNeeds = -1;
  function paintChatNeeds() {
    const n = connectorsPending(p());
    if (lastNeeds !== -1 && lastNeeds !== n) emit("project:badges", p());
    lastNeeds = n;
  }

  function paintActionPop() {
    if (!pop) return;
    paintChatNeeds();
    if (popPhase === "connect" && !popWatching) popItem = pickAction();
    if (!popItem) {
      clearTimeout(popTimer);
      clearTimeout(settleTimer);
      settleTimer = 0;
      popTimer = 0;
      popWatching = false;
      popKey = "";
      pop.hidden = true;
      pop.innerHTML = "";
      return;
    }
    const key = actionKey(popItem.item);
    if (popKey !== key) {
      popKey = key;
      pop.dataset.phase = "";
      // the rail counts every pending connect; say where in that queue this
      // popup sits, so the count and the one visible ask can never disagree
      const queue = connectorsPending(p());
      const label = queue > 1 ? `${popItem.title} · 1 of ${queue}` : popItem.title;
      pop.innerHTML = `<span class="c-action__mark">${popItem.mark}</span><span class="c-action__title">${escapeHtml(label)}</span><span class="sr-only" role="status" data-action-reason></span><button type="button" class="c-action__btn" data-action-connect></button>`;
    }
    pop.hidden = false;
    const phase = popPhase === "connect" && popReason ? "retry" : popPhase;
    const button = pop.querySelector("[data-action-connect]");
    if (pop.dataset.phase !== phase) {
      pop.dataset.phase = phase;
      button.innerHTML = POP_BUTTON[phase]();
      button.disabled = phase === "verifying" || phase === "connected";
    }
    button.title = phase === "retry" ? popReason : "";
    pop.querySelector("[data-action-reason]").textContent = phase === "retry" ? popReason : phase === "connected" ? `${popItem.title}: connected` : "";
  }

  function connectActionPop() {
    if (!popItem) return;
    window.open(popItem.url, "_blank", "noopener");
    popPhase = "verifying";
    popWatching = true;
    popSince = Date.now();
    popReason = "";
    paintActionPop();
    popTimer = setTimeout(verifyActionPop, VERIFY_MS);
  }

  // one probe of the verifier; the watch re-arms itself every few seconds
  // and an immediate check runs when the window refocuses
  async function verifyActionPop() {
    clearTimeout(popTimer);
    popTimer = 0;
    if (!popItem || !popWatching) return;
    const epoch = ++popEpoch;
    let verified = false;
    let reason = VERIFY_UNREACHED;
    try {
      const res = await fetch(`/api/action/verify?project=${encodeURIComponent(projectId)}`);
      if (res.ok) {
        const data = await res.json().catch(() => null);
        verified = data?.verified === true;
        reason = typeof data?.reason === "string" ? data.reason : "";
      }
    } catch {
      verified = false;
    }
    if (popEpoch !== epoch) return;
    if (verified) return settleActionPop();
    popPhase = "connect";
    const expired = Date.now() - popSince >= VERIFY_GIVE_UP;
    popReason = expired ? "" : reason || VERIFY_WAITING;
    paintActionPop();
    if (expired) {
      popWatching = false;
      return;
    }
    popTimer = setTimeout(verifyActionPop, VERIFY_MS);
  }

  // the popup shows Connected, then folds and marks the thread card done
  function settleActionPop() {
    popWatching = false;
    popPhase = "connected";
    paintActionPop();
    const it = popItem?.item;
    if (it) {
      it.done = true;
      settledActions.add(actionKey(it));
    }
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      settleTimer = 0;
      popItem = null;
      popPhase = "connect";
      popReason = "";
      paintActionPop();
    }, 1400);
  }

  function dismissActionPop() {
    if (popItem?.item) settledActions.add(actionKey(popItem.item));
    clearTimeout(popTimer);
    clearTimeout(settleTimer);
    settleTimer = 0;
    popTimer = 0;
    popWatching = false;
    popItem = null;
    popPhase = "connect";
    popReason = "";
    paintActionPop();
  }

  const onWindowFocus = () => {
    if (popWatching && !pop.hidden) verifyActionPop();
  };
  window.addEventListener("focus", onWindowFocus);
  paintActionPop();

  function answerFor(range) {
    const pr = p();
    if (!isRunning(pr)) {
      const open = setupSteps.filter((s) => !pr.setup.done.includes(s));
      const names = { youtube: "the YouTube channel", card: "the card", stripe: "the Stripe account" };
      if (range === "Skip setup for now") return `Nothing to summarise yet: ${pr.name} has no revenue or users until setup is done. ${open.length} step${open.length === 1 ? "" : "s"} left: ${open.map((s) => names[s]).join(", ")}. The checklist is beside this chat.`;
      const first = range === "Stripe first" && open.includes("stripe") ? "stripe" : open[0];
      return `${range}: open "${first === "youtube" ? "Create YouTube channel" : first === "card" ? "Fill in credit card information" : "Stripe account setup"}" in the checklist beside this chat and finish it; I mark it done as it lands. ${open.length - 1 > 0 ? `${open.length - 1} more after that.` : "That is the last one."}`;
    }
    const top = pr.insights.find((i) => i.type === "breakthrough");
    const pct = pr.baseline ? Math.abs(((pr.revenue - pr.baseline) / pr.baseline) * 100).toFixed(1) : "0.0";
    const dir = pr.revenue >= pr.baseline ? "up" : "down";
    const series = kindOf(pr.kind).series?.label || "Active users";
    return `${range}: revenue is ${formatMoney(pr.revenue)}, ${dir} ${pct}% on last month. ${series} at ${formatNum(pr.users.at(-1))}, up ${users30(pr) ?? "0"}% on 30 days earlier.${top ? ` The breakthrough worth reading first: ${top.title.charAt(0).toLowerCase()}${top.title.slice(1)}.` : ""}`;
  }

  // the agent's answer to one message; send() has already put the line in
  // the thread, and answers run one after another
  async function agentRun(text) {
    form.dataset.busy = "1";
    composerInput();
    // the agent finishes what it is doing before it turns to you
    if (busyBy(projectId) === "agent") {
      setStatus("Finishing the current step");
      for (let i = 0; i < 300 && isBusy(projectId); i++) await wait(50);
    } else {
      setStatus("Reading your message");
    }
    await queue;
    if (!root.isConnected) return;
    setBusy(projectId, "user");
    try {
      const running = isRunning(p());
      setStatus("Thinking");
      const started = performance.now();
      const thought = thinkingFor(p(), text);
      await wait(reduceMotion() ? 200 : 1200 + Math.random() * 600);
      const seconds = Math.max(0.1, (performance.now() - started) / 1000);
      // the thought stays off the stream and rides the composer strip instead
      noteThought(thought);
      pushThread(projectId, { kind: "thought", text: thought, seconds }, { own: true });
      follow();
      // not set up yet: first a plan, drafted from the message and changed
      // from the chat until it is agreed; then the agent asks for the three
      // things it needs, as a checklist right here, and waits on it
      if (!running) {
        const sayLine = async (line) => {
          setStatus("Writing");
          const msg = append(msgMarkup("assistant", ""));
          msg.classList.add("is-live");
          await revealText(msg, line, follow);
          msg.classList.remove("is-live");
          pushThread(projectId, { kind: "assistant", text: line }, { own: true });
        };
        const paintPlan = () => {
          const card = thread.querySelector("[data-plan-card]");
          if (card) card.outerHTML = planMarkup(p());
        };
        if (!p().plan?.agreed && !hasSetupCard()) {
          if (!p().plan) {
            if (!p().goal) setProjectGoal(projectId, text);
            setPlan(projectId, planFor(p().kind, p().goal || text));
            input.placeholder = placeholderFor(p());
            await sayLine(`Here is the plan I would run for ${p().name}. Change anything you like, or say it looks good and I will ask for what I need to start.`);
            pushThread(projectId, { kind: "plan" }, { own: true });
            const card = append(planMarkup(p()), { force: true });
            if (!reduceMotion()) card.animate([{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 240, easing: EASE_OUT });
            follow();
            return;
          }
          if (!APPROVAL.test(text.trim())) {
            changePlan(projectId, text);
            paintPlan();
            await sayLine(`Changed: ${text.trim().replace(/[.]+$/, "")}. Anything else, or shall I go ahead?`);
            follow();
            return;
          }
          agreePlan(projectId);
          paintPlan();
          input.placeholder = placeholderFor(p());
        }
        const say = hasSetupCard()
          ? `Still waiting on the setup above: ${setupSteps.length - p().setup.done.length} step${setupSteps.length - p().setup.done.length === 1 ? "" : "s"} left. Once they land I start on this.`
          : `Great, that is the plan. Before I start on ${p().name}, I need three things: the YouTube channel the videos post to, the card the ad spend bills to, and the Stripe account the payouts land in. Go through them here and I start the moment the last one lands.`;
        await sayLine(say);
        if (!hasSetupCard()) {
          if (!p().goal) setProjectGoal(projectId, text);
          pushThread(projectId, { kind: "setup" }, { own: true });
          const slot = append(`<div class="app-thread__setup" data-setup-slot></div>`);
          mountSetups();
          if (!reduceMotion()) slot.animate([{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 240, easing: EASE_OUT });
          follow();
        }
        return;
      }
      await runTool("read_revenue");
      await runTool("read_users");
      // no question back: the answer covers the last 30 days, what the
      // badge compares against
      await runTool("list_insights");
      if (!root.isConnected) return;
      const answer = answerFor("Last 30 days");
      setStatus("Writing the answer");
      const msg = append(msgMarkup("assistant", ""));
      msg.classList.add("is-live");
      await revealText(msg, answer, follow);
      msg.classList.remove("is-live");
      pushThread(projectId, { kind: "assistant", text: answer }, { own: true });
      announce("Answer ready");
    } finally {
      setBusy(projectId, null);
      delete form.dataset.busy;
      restNow();
      composerInput();
    }
  }

  // live mode: the real backend owns the loop; the frontend only mirrors
  // it. Thread items, plan cards and setup cards arrive as store events
  // from the connector; busy clears when the backend says the turn is over
  async function liveRun(text, msgId) {
    setBusy(projectId, "agent");
    form.dataset.busy = "1";
    showThinking();
    const sentAt = Date.now();
    // a conversation is over when its answer lands; the busy flag alone
    // used to be the only signal, and a turn the server never closed with a
    // status event held this promise open forever, and every later send
    // queued behind it (send() chains them), so the second message never
    // reached the backend until a reload
    const answered = () => {
      const last = p().thread[p().thread.length - 1];
      return Boolean(last && last.kind === "assistant" && (last.at || 0) >= sentAt);
    };
    let mission = false;
    try {
      const res = await sendLive(projectId, text, p(), msgId);
      if (!res?.ok) {
        setStatus("Could not reach the agent");
        return;
      }
      // a note folded into a running mission leaves the composer free: the
      // mission keeps streaming and the connector repaints as things land
      if (res.handled === "note") {
        setStatus("Suggestion added to the running work");
        return;
      }
      // a fresh mission is not waited out here: its busy marker lives on the
      // server's status events (live.js clears it on the closing null), and
      // a message sent while it runs must post at once so the server can
      // fold it in as a note rather than queue behind the whole mission
      if (res.missionId) {
        mission = true;
        return;
      }
      // a conversation, an answer to an ask, an approval: wait for the reply
      // or the server's clearing status, never longer than three minutes
      const ceiling = Date.now() + 3 * 60 * 1000;
      while (isBusy(projectId) && !answered() && Date.now() < ceiling) await wait(300);
    } catch (err) {
      console.error(err);
    } finally {
      delete form.dataset.busy;
      if (!mission) {
        setBusy(projectId, null);
        removeThinking();
        restNow();
      }
      composerInput();
    }
  }

  // dictation in flight learns that the box was emptied by a send
  let resetDictation = null;
  // the files attached to the box, by name
  const chipNames = () => [...form.querySelectorAll("[data-chips] .c-chip")].map((c) => c.dataset.name);
  function send(text) {
    const files = chipNames();
    if (!text && !files.length) return;
    if (pendingAnswer) {
      input.value = "";
      unsent.delete(projectId);
      resetDictation?.();
      composerInput();
      pendingAnswer(text);
      return;
    }
    input.value = "";
    // the attachments go with the message: the chips leave the box
    form.querySelector("[data-chips]").innerHTML = "";
    unsent.delete(projectId);
    resetDictation?.();
    composerInput();
    // a live plan gate answers NOW: the mission's busy wait would otherwise
    // hold this message behind it forever, and the gate is exactly what the
    // user is answering. Approval flips the card locally (green, hint
    // collapses) and releases the server loop; other feedback re-drafts
    // a gate with no drafted steps is not a gate: the server keeps an
    // empty plan stub on every project, and reading it as open ate real
    // messages as "plan feedback" before they ever reached the backend
    if (liveConnected() && !p().draft && p().plan?.steps?.length && !p().plan.agreed) {
      const approval = APPROVAL.test(text.trim());
      // the bubble paints here, not in the normal send tail: the gate block
      // returns before that tail runs
      append(msgMarkup("user", text, true), { force: true });
      pushThread(projectId, { kind: "reply", text }, { own: true });
      pushActivity(projectId, "user", approval ? "You agreed to the plan" : `Plan feedback: ${text.trim().slice(0, 60)}`);
      if (approval) {
        agreePlan(projectId);
        planLive(projectId, "agree");
      } else {
        changePlan(projectId, text);
        planLive(projectId, "change", text);
      }
      return;
    }
    const sendBtn = form.querySelector("[data-send]");
    if (!reduceMotion()) sendBtn.animate([{ transform: "translateY(0)" }, { transform: "translateY(-3px)", offset: 0.4 }, { transform: "translateY(0)" }], { duration: 300, easing: EASE_OUT });
    input.focus();
    // your line lands the moment you send it, whatever the agent is on
    append(msgMarkup("user", text, false, files), { force: true });
    // the first message makes the draft a project: it takes a name from
    // the message and its row appears in the rail
    if (p().draft) {
      claimDraft(projectId, text);
      chat.querySelector("[data-chat-title]").textContent = p().name;
      document.title = p().name;
    }
    // the optimistic bubble carries the id the server will adopt for its echo:
    // one item on the wire, never two bubbles for one send
    const msgId = uid();
    pushThread(projectId, { id: msgId, kind: "user", text, files: files.length ? files : undefined }, { own: true });
    const said = text || `Sent ${files.join(", ")}`;
    pushActivity(projectId, "user", `You: ${said.length > 60 ? `${said.slice(0, 60)}…` : said}`);
    // the answers come one after another, in the order you sent
    runs = runs.then(() => (liveConnected() ? liveRun(text || `I attached ${files.join(", ")}`, msgId) : agentRun(text || `I attached ${files.join(", ")}`))).catch((err) => console.error(err));
  }
  let runs = Promise.resolve();

  // voice: while listening a transcript arrives word by word, then it stops itself
  const TRANSCRIPT = "Draft a note to finance about the third quarter export and ask for a sign off by Friday";
  let dictation;
  // the browser's own speech recognition (Chrome, Safari, Edge) fills the
  // box as you speak; a browser without it plays the demo transcript
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognizer = null;

  // the three bars in the button move with how loud you are: the input's
  // level is read off an analyser many times a second and each bar scales
  // to it (the middle one most). Without a microphone the bars keep their
  // own gentle wave
  let meter = null;
  async function startMeter(button) {
    if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext) return;
    const bars = [...button.querySelectorAll(".btn__wave-bar")];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!form.classList.contains("is-listening")) {
        for (const track of stream.getTracks()) track.stop();
        return;
      }
      const context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      context.createMediaStreamSource(stream).connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      let level = 0;
      const tick = () => {
        analyser.getByteTimeDomainData(samples);
        let sum = 0;
        for (const s of samples) {
          const v = (s - 128) / 128;
          sum += v * v;
        }
        const loud = Math.min(1, Math.sqrt(sum / samples.length) * 5);
        level = Math.max(loud, level * 0.82);
        bars.forEach((bar, i) => (bar.style.transform = `scaleY(${(0.45 + level * (i === 1 ? 1.6 : 1.1)).toFixed(3)})`));
        meter.frame = requestAnimationFrame(tick);
      };
      meter = { stream, context, frame: 0 };
      button.classList.add("is-live");
      tick();
    } catch (err) {
      console.error("microphone level:", err);
    }
  }
  function stopMeter(button) {
    if (!meter) return;
    cancelAnimationFrame(meter.frame);
    for (const track of meter.stream.getTracks()) track.stop();
    meter.context.close().catch((err) => console.error(err));
    meter = null;
    button.classList.remove("is-live");
    for (const bar of button.querySelectorAll(".btn__wave-bar")) bar.style.transform = "";
  }
  function listen(button) {
    const r = new Recognition();
    recognizer = r;
    r.lang = navigator.language || "en-US";
    r.continuous = true;
    r.interimResults = true;
    // the speech lands at the caret. Dictation owns one span of the box,
    // the words it has placed so far, and rewrites only that span as the
    // words settle. Edit the box or move the caret and that span is yours
    // for good: dictation starts a new span at the caret with only what is
    // heard from then on, so nothing you deleted comes back
    let finals = "";
    let interim = "";
    let skip = 0;
    let anchor = input.selectionStart ?? input.value.length;
    let span = "";
    let placing = false;
    const place = () => {
      const heard = (finals + interim).slice(skip).replace(/^\s+/, "");
      const value = input.value;
      const start = Math.min(anchor, value.length);
      const before = value.slice(0, start);
      const after = value.slice(start + span.length);
      const lead = before && !/\s$/.test(before) && heard ? " " : "";
      const trail = heard && after && !/^\s/.test(after) ? " " : "";
      span = heard ? `${lead}${heard}${trail}` : "";
      placing = true;
      input.value = before + span + after;
      input.selectionStart = input.selectionEnd = start + span.length - trail.length;
      composerInput();
      placing = false;
    };
    const reanchor = () => {
      if (placing) return;
      anchor = input.selectionStart ?? input.value.length;
      span = "";
      skip = (finals + interim).length;
    };
    // an edit re-anchors; so does a caret moved out of the dictated span
    const onEdit = () => reanchor();
    const onCaret = () => {
      const at = input.selectionStart ?? 0;
      if (at < anchor || at > anchor + span.length) reanchor();
    };
    input.addEventListener("input", onEdit);
    input.addEventListener("keyup", onCaret);
    input.addEventListener("pointerup", onCaret);
    // the box emptied by a send: what was heard so far went with it, and
    // the words from here on start at the top of the empty box
    resetDictation = () => {
      anchor = 0;
      span = "";
      skip = (finals + interim).length;
    };
    const unhook = () => {
      resetDictation = null;
      input.removeEventListener("input", onEdit);
      input.removeEventListener("keyup", onCaret);
      input.removeEventListener("pointerup", onCaret);
    };
    r.onresult = (e) => {
      finals = "";
      interim = "";
      for (const result of e.results) {
        if (result.isFinal) finals += result[0].transcript;
        else interim += result[0].transcript;
      }
      place();
    };
    r.onerror = (e) => {
      console.error("dictation:", e.error);
      unhook();
      if (recognizer !== r) return;
      recognizer = null;
      if (button.getAttribute("aria-pressed") === "true") toggleMic(button);
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        input.placeholder = "Microphone blocked: allow it for this site and try again";
        input.addEventListener("focus", () => (input.placeholder = placeholderFor(p())), { once: true });
      }
    };
    r.onend = () => {
      unhook();
      if (recognizer !== r) return;
      recognizer = null;
      if (button.getAttribute("aria-pressed") === "true") toggleMic(button);
    };
    r.start();
  }

  function toggleMic(button) {
    const on = button.getAttribute("aria-pressed") !== "true";
    button.setAttribute("aria-pressed", String(on));
    button.setAttribute("aria-label", on ? "Stop dictating" : "Dictate");
    form.classList.toggle("is-listening", on);
    clearTimeout(dictation);
    if (!on) {
      input.placeholder = placeholderFor(p());
      if (recognizer) {
        const r = recognizer;
        recognizer = null;
        r.stop();
      }
      stopMeter(button);
      announce("Stopped listening");
      input.focus();
      return;
    }
    input.placeholder = "Listening";
    announce("Listening");
    startMeter(button);
    if (Recognition) return listen(button);
    const words = TRANSCRIPT.split(" ");
    const said = [];
    const step = () => {
      if (!form.classList.contains("is-listening")) return;
      said.push(words[said.length]);
      input.value = said.join(" ");
      composerInput();
      if (said.length < words.length) dictation = setTimeout(step, reduceMotion() ? 0 : 90 + Math.random() * 120);
      else dictation = setTimeout(() => toggleMic(button), 600);
    };
    dictation = setTimeout(step, 500);
  }

  function addChip(name) {
    form.querySelector("[data-chips]").insertAdjacentHTML("beforeend", `<span class="c-chip" data-name="${escapeHtml(name)}">${icon(isImage(name) ? "image" : "file-text")}${escapeHtml(name)}<button type="button" class="c-chip__x" aria-label="Remove ${escapeHtml(name)}" data-remove>${icon("x")}</button></span>`);
    composerInput();
    announce(`Attached ${name}`);
  }

  // the chip and its menu read the mode the project is on
  function paintMode() {
    const chip = form.querySelector("[data-mode-chip]");
    chip.innerHTML = `${modeChip(p())}${icon("chevron-down")}`;
    for (const item of form.querySelectorAll("[data-mode]")) item.setAttribute("aria-checked", String(item.dataset.mode === projectMode(p())));
  }

  function setModel(name) {
    const label = form.querySelector("[data-menu-label]");
    const from = label.getBoundingClientRect().width;
    label.textContent = name;
    if (!reduceMotion()) {
      const to = label.getBoundingClientRect().width;
      label.style.overflow = "hidden";
      label.animate([{ width: `${from}px`, opacity: 0.4 }, { width: `${to}px`, opacity: 1 }], { duration: 200, easing: EASE_STD }).onfinish = () => (label.style.overflow = "");
    }
    setProjectModel(projectId, name);
    announce(`Model set to ${name}`);
  }

  function closeDropdowns() {
    for (const btn of chat.querySelectorAll("[data-menu][aria-expanded='true']")) {
      btn.setAttribute("aria-expanded", "false");
      btn.parentElement.querySelector(".c-menu").hidden = true;
    }
  }

  chat.addEventListener("click", (e) => {
    // a link on a tool card's summary line opens its page without folding
    // the card open or shut
    const link = e.target.closest("a.c-msg__link");
    if (link && link.closest("summary")) {
      e.preventDefault();
      window.open(link.href, "_blank", "noopener");
      return;
    }
    // a milestone with something made behind it plays it right here
    const viewable = e.target.closest("[data-view-src]");
    if (viewable && !e.target.closest("a")) {
      e.preventDefault();
      return mediaDialog(viewable.dataset.viewSrc, viewable.dataset.viewTitle || "What the agent made");
    }
    // the plan's button is the same as saying so
    if (e.target.closest("[data-plan-agree]")) return send("Looks good, go ahead");
    // the connect popup docked over the composer
    if (e.target.closest("[data-pause-toggle]")) return togglePause();
    // the connect popup docked over the composer
    if (e.target.closest("[data-action-connect]")) return connectActionPop();
    if (e.target.closest("[data-action-dismiss]")) return dismissActionPop();
    const dd = e.target.closest("[data-menu]");
    if (dd) {
      const menu = dd.parentElement.querySelector(".c-menu");
      const open = menu.hidden;
      closeDropdowns();
      menu.hidden = !open;
      dd.setAttribute("aria-expanded", String(open));
      if (open) menu.querySelector("[role=menuitem], [role=menuitemradio]")?.focus();
      return;
    }
    const value = e.target.closest(".c-dd [data-value]");
    if (value) {
      setModel(value.dataset.value);
      closeDropdowns();
      chat.querySelector("[data-menu]").focus();
      return;
    }
    const mode = e.target.closest(".c-dd [data-mode]");
    if (mode) {
      setProjectMode(projectId, mode.dataset.mode);
      paintMode();
      closeDropdowns();
      form.querySelector("[data-mode-chip]").focus();
      announce(mode.dataset.mode === "ask" ? "Ask mode: the agent asks before it acts" : "Yolo mode: the agent never asks");
      return;
    }
    if (e.target.closest("[data-mic]")) return toggleMic(e.target.closest("[data-mic]"));
    if (e.target.closest("[data-attach]")) return form.querySelector("[data-file]").click();
    const remove = e.target.closest("[data-remove]");
    if (remove) {
      remove.closest(".c-chip").remove();
      composerInput();
    }
  });
  form.querySelector("[data-file]").addEventListener("change", (e) => {
    for (const f of e.target.files) addChip(f.name);
    e.target.value = "";
  });
  input.addEventListener("input", () => {
    composerInput();
    if (input.value) unsent.set(projectId, input.value);
    else unsent.delete(projectId);
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    send(input.value.trim());
  });
  chat.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && e.target === input) {
      e.preventDefault();
      send(input.value.trim());
    }
    if (e.key === "Escape" && !pop.hidden) return dismissActionPop();
    if (e.key === "Escape") closeDropdowns();
    const menu = e.target.closest(".c-menu");
    if (menu && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      const items = [...menu.querySelectorAll("[role=menuitem], [role=menuitemradio]")];
      const i = items.indexOf(document.activeElement);
      items[(i + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length].focus();
    }
  });
  const onPointer = (e) => {
    if (!e.target.closest(".c-dd")) closeDropdowns();
  };
  document.addEventListener("pointerdown", onPointer);
  if (unsent.has(projectId)) input.value = unsent.get(projectId);
  composerInput();
  mountSetups();
  restNow();
  armThoughtRotate();
  // a reload mid-run: the thinking marker comes straight back up, unless the
  // chat is paused, which reads as idle everywhere. It keys on work in
  // flight (the busy flag, or a mission actually running), never on
  // setup.complete: a project that finished setup long ago is not thinking
  // now, and keying on it painted a spinner under the last line forever.
  if (!p().paused && (busyBy(projectId) === "agent" || (p().missions || []).some((m) => m.status === "running"))) showThinking();
  // a question left open when you were last here comes back in the form
  {
    const waiting = p().thread.find((t) => t.kind === "ask" && !t.answered);
    if (waiting && projectMode(p()) === "ask") openAsk(waiting);
  }

  const off = subscribe((topic, payload) => {
    if (!root.isConnected) return;
    if (topic === "thread" && payload.id === projectId && !payload.own) enqueue(payload.item);
    else if (topic === "setup" && payload.id === projectId && payload.setup.complete && !p().thread.some((t) => t.setupDone)) {
      // the last step landed: the card folds, the agent says it is starting
      mountSetups();
      input.placeholder = placeholderFor(p());
      restNow();
      paintPill();
      if (liveConnected()) {
        // the backend owns the thread and says this line itself
        p().thread.push({ kind: "assistant", text: "All set.", setupDone: true, at: Date.now() });
        return;
      }
      const say = `All set. I am starting on ${p().name} now; the numbers and the log are on the right.`;
      pushThread(projectId, { kind: "assistant", text: say, setupDone: true }, { own: true });
      pushActivity(projectId, "work", "Started work");
      enqueue({ kind: "assistant", text: say });
    } else if (topic === "pause" && payload.id === projectId) {
      paintPaused();
      // a paused chat never looks like it is still thinking: the marker
      // goes down at once and stays down until resume
      removeThinking();
      restNow();
    } else if (topic === "live:status" && payload.id === projectId) {
      if (!p().paused) {
        noteThought(payload.text);
        setStatus(payload.text || "Thinking");
      }
    }
    else if ((topic === "plan:updated" || topic === "plan") && payload.id === projectId) {
      // "plan" is the store's own emit on agree/change; "plan:updated" is the
      // live connector's after a server event - both repaint the card
      const card = thread.querySelector("[data-plan-card]");
      if (card) card.outerHTML = planMarkup(p());
    } else if (topic === "project:think" && payload.id === projectId && !form.dataset.busy) restNow();
    else if (topic === "busy" && payload.id === projectId) {
      // the thinking marker tracks the busy flag from any surface, but a
      // paused chat never wears it: pause wins over every busy source
      if (payload.who && !p().paused) showThinking();
      else if (!payload.who && !form.dataset.busy) {
        removeThinking();
        restNow();
      }
      paintPauseButton();
    }
    else if (topic === "model" && payload.id === projectId) form.querySelector("[data-menu-label]").textContent = payload.model;
    // the loop names the project after it frames the first mission; the
    // header follows the same name the rail shows
    else if (topic === "projects" && payload.changed === projectId) {
      chat.querySelector("[data-chat-title]").textContent = p().name;
      // a project upsert may have settled an action server-side
      if (popWatching) return;
      paintActionPop();
    }
    else if (topic === "mode" && payload.id === projectId) {
      paintMode();
      // Yolo does not wait on you: a question still open is skipped
      if (projectMode(p()) !== "ask" && askOpen) pendingAnswer?.(null);
    }
  });

  return {
    focus: () => input.focus(),
    setTitle: (name) => (chat.querySelector("[data-chat-title]").textContent = name),
    clear: () => {
      thread.innerHTML = "";
      liveTurn = null;
      paintPill();
    },
    destroy: () => {
      clearTimeout(dictation);
      // leaving the chat mid-dictation lets the microphone go
      if (recognizer) {
        const r = recognizer;
        recognizer = null;
        r.stop();
      }
      stopMeter(form.querySelector("[data-mic]"));
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("focus", onWindowFocus);
      clearTimeout(popTimer);
      clearTimeout(settleTimer);
      clearTimeout(rotateTimer);
      edges.disconnect();
      edgeWatch.disconnect();
      setupCleanup();
      off();
    },
  };
}
