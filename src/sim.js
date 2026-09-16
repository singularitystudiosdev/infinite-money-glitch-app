// sim.js: the frontend's own backend. Every project's agent keeps working
// on its own: it thinks, calls tools and says what it did in its thread,
// stops now and then to ask, makes sales, finds insights and moves its
// missions along, all on timers, whatever page is open. Every change goes
// through the store, so the page in view patches itself. None of it posts
// to the bell: the bell is for what you did and what the assistant asks.
import { ASKS_COMMON, INSIGHT_POOL, WORK_COMMON } from "./data.js";
import { eventText, kindOf } from "./kinds.js";
import { busyBy, currentId, emit, get, isActive, isBusy, projectMode, projects, pushActivity, pushThread, retireTask, setBusy, spendCredit } from "./store.js";
import { formatMoney, pick, wait } from "./util.js";

// what an agent does is mostly its kind's own work, now and then the
// work every kind shares
const workFor = (p) => (Math.random() < 0.8 ? pick(kindOf(p.kind).work) : pick(WORK_COMMON));

const timers = new Set();
let running = false;

function every(min, max, fn) {
  const loop = () => {
    const t = setTimeout(() => {
      if (!running) return;
      try {
        fn();
      } catch (err) {
        console.error(err);
      }
      loop();
    }, min + Math.random() * (max - min));
    timers.add(t);
  };
  loop();
}

// the next thought is any of the project's own but the one showing
function nextThought(p) {
  if (p.thoughts.length < 2) return;
  let next = p.step;
  while (next === p.step) next = Math.floor(Math.random() * p.thoughts.length);
  p.step = next;
}

// a breakthrough is a line in the thread and the log, nothing more
function breakthrough(p) {
  pushActivity(p.id, "breakthrough", "Breakthrough: the numbers moved past the old ceiling");
  comment(p, "The numbers just moved past the old ceiling. [Writing that up](https://notion.so) before anything else.");
}

// the open chat is the one you are watching, so it gets more than its share
function pickProject(filter = () => true) {
  const list = projects().filter(filter);
  if (!list.length) return null;
  const open = list.find((p) => p.id === currentId());
  return open && Math.random() < 0.6 ? open : pick(list);
}

// what the agent says after a tool comes back: the result, read aloud
function toolLine(tool) {
  const lines = tool.result.split("\n").map((s) => s.trim().replace(/[.]$/, "")).filter(Boolean).slice(0, 3);
  const summary = lines.join("; ");
  return pick([`${tool.name} came back: ${summary}.`, `Reading that: ${summary}.`, `Got it. ${summary}.`, `So: ${summary}. Moving on.`]);
}

// the agent talks itself through one unit of work in the thread: what it
// is about to do, each tool call and what it came back with, then what it
// makes of it
async function workTurn(p) {
  if (isBusy(p.id)) return;
  setBusy(p.id, "agent");
  try {
    const step = workFor(p);
    nextThought(p);
    emit("project:think", p);
    pushThread(p.id, { kind: "assistant", text: step.thought });
    await wait(1400 + Math.random() * 800);
    // a pause you set lands between steps: the turn stops at its next one
    for (const tool of step.tools) {
      if (!running || p.paused) return;
      pushThread(p.id, { kind: "tool", name: tool.name, icon: tool.icon, args: tool.args, result: tool.result });
      await wait(900 + Math.random() * 700);
      if (p.paused) return;
      pushThread(p.id, { kind: "assistant", text: toolLine(tool) });
      await wait(900 + Math.random() * 600);
    }
    if (p.paused) return;
    pushThread(p.id, { kind: "assistant", text: step.say });
    pushActivity(p.id, "work", step.say);
    if (p.id !== currentId()) {
      p.unread += 1;
      emit("project:badges", p);
    }
    spendCredit();
  } finally {
    setBusy(p.id, null);
  }
}

// between units of work the agent keeps talking: what it is watching,
// what it is holding, what it will do next
const IDLE = [
  "Nothing is waiting on me this minute. Watching the numbers until the next thing lands.",
  "Queue is clear. I will check it again shortly.",
  "Holding the draft until the morning; the numbers are steadier then.",
  "Reading back over the last hour before I pick the next thing.",
];

function idleLine(p) {
  if (isBusy(p.id)) return;
  const line = Math.random() < 0.6 ? `${p.thoughts[p.step].replace(/[.]$/, "")}.` : pick(IDLE);
  pushThread(p.id, { kind: "assistant", text: line });
  if (p.id !== currentId()) {
    p.unread += 1;
    emit("project:badges", p);
  }
}

// in Ask mode the agent stops for permission now and then: the question
// goes in the thread as a card with its options, the rail gets the orange
// count, and its own work waits until you answer
const askFor = (p) => (Math.random() < 0.8 ? pick(kindOf(p.kind).asks) : pick(ASKS_COMMON));
const waitingOnYou = (p) => projectMode(p) === "ask" && p.thread.some((t) => t.kind === "ask" && !t.answered);
function askTurn(p) {
  const q = askFor(p);
  pushThread(p.id, { kind: "ask", id: Math.random().toString(36).slice(2, 9), question: q.question, options: q.options, answered: false });
  pushActivity(p.id, "needs", q.question);
  if (p.id !== currentId()) {
    p.needs = Math.min(9, p.needs + 1);
    emit("project:badges", p);
  }
}

// an agent works only once its project is set up; before that it waits
// for a first message and the setup that follows
function tickWork() {
  const p = pickProject((q) => isActive(q) && !isBusy(q.id) && !waitingOnYou(q));
  if (!p) return;
  if (projectMode(p) === "ask" && Math.random() < 0.12) return askTurn(p);
  if (Math.random() < 0.03) return breakthrough(p);
  if (Math.random() < 0.2) return idleLine(p);
  workTurn(p);
}

// a thing that happened gets a line in the thread too, unless you are
// mid-conversation with the agent
const comment = (p, text) => {
  if (isBusy(p.id) === false || busyBy(p.id) !== "user") pushThread(p.id, { kind: "assistant", text });
};

function tickSale() {
  const p = pickProject(isActive);
  if (!p) return;
  const amount = 80 + Math.floor(Math.random() * 640);
  p.revenue += amount;
  emit("revenue", p);
  pushActivity(p.id, "sale", `Sale added, ${formatMoney(amount)}`);
  comment(p, pick([`A sale just landed, [${formatMoney(amount)}](https://dashboard.stripe.com/payments). Logging it against today's spend.`, `${formatMoney(amount)} in. [Revenue](https://dashboard.stripe.com/payments) is at ${formatMoney(p.revenue)} for the month now.`]));
}

// the kind's own event: a video went up, a lead replied, an order landed.
// It goes in the log under its kind, which is a tab on the Updates card
function tickEvent() {
  const p = pickProject(isActive);
  if (!p) return;
  const events = kindOf(p.kind).events;
  if (!events?.length) return;
  const event = pick(events);
  pushActivity(p.id, event.kind, eventText(pick(event.texts)));
}

function tickInsight() {
  const p = pickProject(isActive);
  if (!p) return;
  const next = INSIGHT_POOL[p.nextInsight % INSIGHT_POOL.length];
  p.nextInsight += 1;
  p.insights = [{ ...next, id: Math.random().toString(36).slice(2, 9), at: Date.now() }, ...p.insights].slice(0, 8);
  emit("insight", p);
  pushActivity(p.id, "insight", next.title, { delta: next.delta });
  comment(p, `Something worth noting: ${next.title.charAt(0).toLowerCase()}${next.title.slice(1)}. ${next.why}`);
}

// a manager's mission creeps; a subagent's task races. One in the lane
// moves a step; at 100 it shows done for a moment, then leaves the card
// and the lane starts the next (store.retireTask)
const STEP = { manager: [1, 4], subagent: [6, 18] };
const DONE_HOLD = 2400;
function tickLane(lane) {
  const inLane = (p) => p.missions.filter((m) => m.lane === lane && m.progress < 100);
  // the open chat gets more than its share, so what you watch keeps moving
  const p = pickProject((x) => isActive(x) && inLane(x).length > 0);
  if (!p) return;
  const m = pick(inLane(p));
  const [lo, hi] = STEP[lane];
  m.progress = Math.min(100, m.progress + lo + Math.floor(Math.random() * (hi - lo + 1)));
  emit("mission", { project: p, mission: m });
  if (m.progress < 100) return;
  pushActivity(p.id, "mission", `${lane === "manager" ? "Mission" : "Task"} done: ${m.title}`);
  const title = `${m.title.charAt(0).toLowerCase()}${m.title.slice(1)}`;
  if (lane === "manager") comment(p, `Finished: ${m.url ? `[${title}](${m.url})` : title}. Picking up the next one.`);
  const t = setTimeout(() => retireTask(p.id, m.id), DONE_HOLD);
  timers.add(t);
}

// the kind's own tiles move by their own step: sign-ups, orders, replies
function tickStats() {
  const p = pickProject(isActive);
  if (!p || !p.stats) return;
  const tiles = kindOf(p.kind).tiles.filter((t) => t.tick && p.stats[t.id] !== undefined);
  if (!tiles.length) return;
  const t = pick(tiles);
  const [lo, hi] = t.tick;
  const step = lo + Math.random() * (hi - lo);
  p.stats[t.id] = t.format === "pct" ? Math.round((p.stats[t.id] + step) * 10) / 10 : Math.max(0, p.stats[t.id] + Math.round(step));
  emit("stats", { project: p, tile: t.id });
}

// active users drift on the latest day, so the graph is alive without
// ever changing its shape
function tickUsers() {
  const p = pickProject(isActive);
  if (!p || p.users.at(-1) === 0) return;
  const last = p.users.length - 1;
  p.users[last] = Math.max(1, p.users[last] + Math.floor(Math.random() * 7) - 2);
  emit("users", p);
}

export function startSim() {
  if (running) return;
  running = true;
  every(1800, 4000, tickWork);
  every(15000, 40000, tickSale);
  every(25000, 45000, tickInsight);
  every(14000, 32000, tickEvent);
  every(4000, 8000, () => tickLane("manager"));
  every(1400, 2800, () => tickLane("subagent"));
  every(6000, 12000, tickUsers);
  every(5000, 11000, tickStats);
}

export function stopSim() {
  running = false;
  for (const t of timers) clearTimeout(t);
  timers.clear();
}

export const simState = () => ({ running, credits: get().credits.balance });
