// demo/scripts/contract.js: what a demo script must be, and a validator.
// run.js plays any module that satisfies this; a script that fails the
// check fails loudly here instead of half-playing on the page. Keeping the
// shape in one place is what makes "a new goal is a new data file" true:
// add a file, run the validator, add it to index.js, done.
//
// The validator is deliberately shallow about CONTENT (a tool's args, a
// note's words, a number's size are the goal's own business) and strict
// about SHAPE, because shape is what run.js dereferences.

// every field run.js reads, with the type it must have. "fn" marks a
// factory: run.js calls it, so it has to be a function, never a string.
export const REQUIRED = {
  id: "string", // the route id, #/p/<id>
  title: "string",
  request: "string",
  template: "string", // a store template id (src/data.js TEMPLATES)
  assets: "string", // this demo's media folder, e.g. assets/demo/flour-and-salt
  shared: "string", // shared media folder, e.g. assets/demo
  quote: "object",
  outro: "object",
  plan: "array",
  thinking: "object", // { request: [], first: [] }
  planSay: "fn",
  connect: "object", // probe, platform, mark, auth, title, url, say, statusOpening, statusWaiting, log
  account: "string",
  setup: "object", // status, line, log, done, summary, missions, tool, steps
  work: "array", // [{ tool, shot?, note? }]
  workStatus: "array",
  workLog: "string",
  workSay: "string",
  media: "array",
  mediaNote: "string",
  mediaInsight: "object", // { kind, text, delta }
  voice: "object", // { tool, shot, milestone }
  voiceLog: "string",
  render: "object",
  firstLength: "string", // the first artifact's own length, e.g. "3:04"
  logs: "object", // the activity-log kinds: { upload, day, delta }
  upload: "fn", // (title, slot) => tool
  artifact: "fn", // (video, title, slot, length) => card data
  liveSay: "fn",
  status: "object", // { waiting, cutting, readingWeek }
  more: "array", // [{ video, title, slot, length, gen, voice, numbers }]
  moreStatus: "fn",
  weekIntro: "string",
  week: "array", // [{ day, tools, note }]
  videos: "array",
  titles: "array",
  slots: "array",
  speeds: "array", // one speed per week day
  weekStatus: "fn", // (day, what) => string
  weekUploadLengths: "array", // one length per slot
  numbers: "object", // curve, final, shapes, tiles, crossing, dayLine, gainedLine
  generated: "object", // { file, seconds }
  // embedUrl is OPTIONAL: a goal with no embeddable player carries null and
  // the browser window frames the artifact's own address instead
};

// the nested shapes run.js dereferences by name
export const REQUIRED_NESTED = {
  connect: ["probe", "platform", "mark", "auth", "title", "url", "say", "statusOpening", "statusWaiting", "log"],
  setup: ["status", "line", "log", "done", "summary", "missions", "tool", "steps"],
  "setup.steps": ["first", "upload", "more", "week"],
  voice: ["tool", "shot", "milestone"],
  mediaInsight: ["kind", "text", "delta"],
  numbers: ["curve", "final", "shapes", "tiles", "crossing", "dayLine", "gainedLine"],
  logs: ["upload", "day", "delta"],
  "numbers.shapes": ["views", "subs", "watch", "comments", "revenue"],
  "numbers.final": ["subs", "comments", "watch", "revenue"],
  generated: ["file"],
};

const isFn = (v) => typeof v === "function";
const typeOk = (want, v) => {
  if (want === "fn") return isFn(v);
  if (want === "array") return Array.isArray(v);
  if (want === "object") return v !== null && typeof v === "object" && !Array.isArray(v);
  return typeof v === want;
};

// validateScript(s): [] when the script is playable, otherwise one message
// per problem. Same call drives a unit check and a pre-dispatch guard.
export function validateScript(s) {
  const bad = [];
  if (!s || typeof s !== "object") return ["the module has no default export object"];
  for (const [key, want] of Object.entries(REQUIRED)) {
    if (!(key in s)) bad.push(`missing ${key}`);
    else if (!typeOk(want, s[key])) bad.push(`${key} must be ${want}, got ${Array.isArray(s[key]) ? "array" : typeof s[key]}`);
  }
  // the nested names run.js dereferences
  for (const [path, keys] of Object.entries(REQUIRED_NESTED)) {
    const [head, sub] = path.split(".");
    const host = sub ? s[head]?.[sub] : s[head];
    if (!host || typeof host !== "object") continue; // reported above
    for (const k of keys) if (!(k in host)) bad.push(`missing ${path}.${k}`);
  }
  // shapes run.js iterates as [lead, pow] pairs
  if (s.numbers?.shapes) {
    for (const [k, pair] of Object.entries(s.numbers.shapes)) {
      if (!Array.isArray(pair) || pair.length !== 2 || pair.some((n) => typeof n !== "number")) bad.push(`numbers.shapes.${k} must be [lead, pow]`);
    }
  }
  // the week and its speeds must line up: run.js indexes speeds by day
  if (Array.isArray(s.week) && Array.isArray(s.speeds) && s.speeds.length < s.week.length) bad.push(`speeds needs one entry per week day (${s.week.length}), has ${s.speeds.length}`);
  // every slot needs a length, or the upload card prints "undefined"
  if (Array.isArray(s.slots) && Array.isArray(s.weekUploadLengths) && s.weekUploadLengths.length < s.slots.length) bad.push(`weekUploadLengths needs one entry per slot (${s.slots.length})`);
  if (s.id && !/^[a-z0-9-]+$/.test(s.id)) bad.push(`id must be a route-safe slug, got "${s.id}"`);
  // optional, but if given it must be callable
  if (s.embedUrl != null && typeof s.embedUrl !== "function") bad.push("embedUrl must be a function or null");
  return bad;
}

export const assertScript = (s) => {
  const bad = validateScript(s);
  if (bad.length) throw new Error(`demo script ${s?.id || "(no id)"} is not playable:\n  - ${bad.join("\n  - ")}`);
  return s;
};