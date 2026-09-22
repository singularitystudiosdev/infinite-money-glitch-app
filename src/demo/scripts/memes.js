// demo/scripts/memes.js: the news-meme goal, as data. One goal out of the
// P16 remakes: an X account that reads the day's odd news, remakes the story
// as a meme with an AI pass over a real template, checks the caption against
// policy BEFORE it posts, and posts three a day. run.js plays it; nothing in
// run.js knows this goal happened. Authored against climbing.js's shape and
// checked by contract.js#validateScript.
//
// Captures under assets/demo/meme-posts are real pages of the real services
// (imgflip's template picker and meme generator, a UPI Odd News story, X's
// own surfaces), taken headless; manifest.json beside them carries each
// source URL, its capture time and what it shows.
import { YOUTUBE_MARK } from "../../icons.js"; // unused mark kept out; see X_MARK

export const DEMO_ID = "meme-posts";
export const ASSETS = "assets/demo/meme-posts";
// the generation and voice sites, captured once and shared
export const SHARED = "assets/demo";

export const REQUEST = "Make me a twitter that posts memes remade with ai and relevant to current news, three a day";
export const TITLE = "News memes";
export const HANDLE = "@newsthatmemes";
export const ACCOUNT = "ada@lovelace.co";

// the X mark: the brand's own glyph (about.x.com brand assets), injected as
// the artifact card's mark. The connect popup takes a mark NAME resolved
// through ui/chat.js BRAND_MARKS, which carries youtube and stripe only, so
// the popup draws its neutral mark until an "x" entry lands there.
export const X_MARK = `<svg class="c-task__mark" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.657l-5.214-6.817-5.966 6.817H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`;

// the plan: X under the user's own sign-in, three posts a day, the tests
// that find which format lands, and what it costs. Photo generation is
// $0.04 an image on fal.ai's nano-banana 2 and $0.03 on FLUX.1 schnell;
// storage and the analytics read are cents. Three posts a day that regenerate
// four candidates each is about $0.21 a post.
export const PLAN = [
  { title: "Open the account with your X sign-in", detail: "One sign-in from you; the account, its handle and its art are created under your own login and the token is kept, never a password." },
  { title: "Post three times a day", detail: "08:00, 13:00 and 19:00 in your local time. Every post is a story from the day's news, a template it fits, an AI pass over the template's image, and a caption written for the format, not the story." },
  { title: "Check the caption before it posts", detail: "Every caption and alt text goes through the platform's policy check first: no private person named, no health or death claim, no date of birth, no campaign or sponsored line. A flagged post never reaches the queue." },
  { title: "A/B test what wins", detail: "Template family (reaction still, two-panel, text-on-template), caption length (under 40 characters, 40 to 90, a thread), aspect (1:1, 4:5, 9:16) and slot; two arms at a time, decided on reposts per 1,000 impressions." },
  { title: "Estimated cost: about $0.21 a post", detail: "$0.16 for four generated candidates, $0.03 for the upload-size render, $0.02 for the analytics read. Three a day is about $19 a month." },
  { title: "Report every Monday", detail: "Followers, impressions, the format that won each test and the one change for next week." },
];

export const THINKING = {
  request: ["Reading the brief: one account, three posts a day, every post tied to the day's news", "Checking what the meme accounts that already win post, and what they get flagged for", "Costing four generated candidates a post across the image models"],
  first: ["Reading the day's odd-news wire for a story with a picture in it", "Reading the story and pulling the one line people would recognise", "Browsing the template library for the format the line fits", "Regenerating the template image so the post is not a repost", "Writing the caption and the alt text, then the policy check", "Posting it and reading the post back an hour later"],
};

// the first post, worked in full: every tool call, the note it leaves, and
// the screenshot it took. A shot is what the agent was looking at.
export const FIRST_POST = [
  {
    tool: { name: "read_news", icon: "search", args: 'wire: odd news, window: 24h, sort: pictures', result: "31 stories\nUPI Odd News, Aug. 24: kinkajou, Texas\nBBC, Aug. 23: the 20-toed cat\nAP, Aug. 24: 400 lb gourd" },
    shot: { file: "news-article.png", caption: "UPI Odd News: the kinkajou story, Aug. 24" },
    note: "The kinkajou story is the one every other account has not posted yet, and it is dated today. A story with a picture people already recognise is what a meme needs.",
  },
  {
    tool: { name: "open_article", icon: "compass", args: "url: upi.com/Odd_News/2026/08/24, quote: 2 lines", result: "published Aug. 24, 1:53 p.m.\n\"possibly a monkey or small kangaroo\"\npolice were called out Thursday" },
    note: "The dated source is the first thing I keep: 24 August, UPI, bylined. The line is the police description, not the animal's name. A meme caption that names the animal is a caption nobody laughs at.",
  },
  {
    tool: { name: "browse_templates", icon: "image", args: "library: imgflip, sort: top 30 days", result: "Drake Hotline Bling\nTwo Buttons\nDistracted Boyfriend\nUNO Draw 25 Cards\nThey're The Same Picture" },
    shot: { file: "templates.png", caption: "imgflip: the top meme templates, 30 days" },
    note: "Templates everyone already knows do the work for me: the joke lands in the first glance. Top 30 days is the pool, never the all-time list.",
  },
  {
    tool: { name: "pick_template", icon: "layout-grid", args: 'template: Drake Hotline Bling, id: 30b1gx, panels: 2', result: "chosen\n2 panels, 1200x1200 source\nlighting and crop read as a repost: needs the AI pass" },
    shot: { file: "template-chosen.png", caption: "imgflip: Drake Hotline Bling loaded in the generator" },
    note: "Drake carries want/do not want, which is exactly the police description. A template used as-is is a repost, so the image goes through the model before it goes out.",
  },
  {
    tool: { name: "check_policy", icon: "shield-check", args: "caption, alt text, source line", result: "no flags\nno private person named\nno health or cause of death\ndate and place only: Aug. 24, Texas" },
    note: "The check runs before the post, not after a report. Nothing here names the person who called it in, and nothing claims what the animal was doing when it was found.",
  },
];

export const GENERATION = [
  { tool: { name: "generate_image", icon: "sparkles", args: "model: nano-banana 2, template: Drake, panels: 2", result: "done in 7 s\nfaces re-rendered, same pose\nno watermark" }, shot: { file: "regenerate.png", caption: "fal.ai: nano-banana 2 re-rendering the template" } },
  { tool: { name: "generate_image", icon: "sparkles", args: "model: FLUX.1 schnell, template: Drake, panels: 2", result: "done in 3 s\nholds the shape, the second face drifts" } },
  { tool: { name: "generate_image", icon: "sparkles", args: "model: nano-banana 2, panel: 2, re-roll", result: "done in 6 s\nthe bottom panel reads at thumbnail size" } },
];
export const GENERATION_NOTE = "nano-banana 2 keeps both faces and the crop; FLUX.1 schnell is three times faster and drops the second face on the re-roll. Re-roll the panel that carries the joke, never the whole template.";

// the sound the caption points at: X's posts carry audio, and the reply
// carries the trending track the meme was cut to
export const STING = {
  tool: { name: "generate_sting", icon: "mic", args: "length: 1.2 s, mood: deadpan, from: trending audio", result: "1.2 s\npeak -3 dB\nmatched to: trending, comedy" },
  shot: { file: "post-audio.png", caption: "X: the trending sound the reply carries" },
  milestone: { title: "Sound picked", text: "1.2 s · trending, comedy · attached to the post", src: "sting.wav", icon: "mic", media: "audio", mediaTitle: "Post sound" },
};

// what the platform composes before the post goes out
export const COMPOSE = { name: "compose_post", icon: "layout-grid", args: "1080x1080, caption overlay on, watermark off, alt text required", result: "composed\n1:1 and 4:5 exports\nalt text: 148 characters\ncaption: 62 characters" };
export const POST = (title, slot = "08:00") => ({ name: "post_to_x", icon: "x", args: `caption: "${title}", slot: ${slot}`, result: "posted\nvisibility: public\nreplies: everyone\npolicy: checked, no flags" });

// the three slots the three posts go out in
export const SLOTS = ["08:00", "13:00", "19:00"];

// the montage: a week of learning at five times speed. Each day is a few
// tool calls and the note the day taught, then its three posts
export const WEEK = [
  {
    day: 2,
    tools: [
      { name: "read_post", icon: "eye", args: "post: 1, window: 6 h", result: "18.4k impressions\n1,208 reposts\n62 quote posts\nfirst reply: the animal's name, guessed wrong" },
      { name: "read_experiment", icon: "compass", args: "test: caption-length-1", result: "under 40 chars: 41 reposts per 1k\n40 to 90: 22 per 1k" },
    ],
    note: "Reading the post back is the point of the account: the short caption out-reposts the long one two to one. The joke goes in the image, the caption only completes it.",
  },
  {
    day: 3,
    tools: [
      { name: "read_replies", icon: "mail", args: "since: 24 h, sort: top", result: "418 replies\n71 ask which animal it is\n41 already quote it with the wrong name" },
      { name: "set_comment_pin", icon: "check", args: "reply: the source line, dated", result: "pinned\nsource: UPI, Aug. 24" },
    ],
    note: "The pin answers the question once, with the dated source, so the replies stop guessing. One pinned source line bought back most of the second day's replies.",
  },
  {
    day: 4,
    tools: [
      { name: "read_experiment", icon: "compass", args: "test: template-2", result: "reaction still: 34 per 1k\ntwo-panel: 28 per 1k\ntext-on-template: 12 per 1k" },
      { name: "set_format", icon: "sliders-vertical", args: "family: reaction still, fallback: two-panel", result: "applied to the queue" },
    ],
    note: "A reaction still beats a two-panel here, and text laid over the template loses badly: people screenshot the image and the text goes with it. The queue drops text-on-template entirely.",
  },
  {
    day: 5,
    tools: [
      { name: "read_engagement", icon: "activity", args: "by: hour, days: 4", result: "peak: 20:00 to 23:00\n08:00 slot: 31% of peak" },
      { name: "set_schedule", icon: "calendar-clock", args: "slots: 09:30, 14:00, 20:00", result: "applied from tomorrow" },
    ],
    note: "The audience is awake at night. The 08:00 post moves to 09:30 and the evening one to 20:00, which is where the quote posts start.",
  },
  {
    day: 6,
    tools: [
      { name: "read_experiment", icon: "compass", args: "test: source-1", result: "animal stories: 44 per 1k\nmissing-object stories: 19 per 1k\nweather oddities: 9 per 1k" },
      { name: "set_source_mix", icon: "search", args: "wire: odd news, animals: 60%, rest: 40%", result: "applied to the queue" },
    ],
    note: "Anything with an animal in it does four times the oddities without one. The wire read now pulls animal stories first and the rest only when the day is thin.",
  },
  {
    day: 7,
    tools: [
      { name: "read_engagement", icon: "activity", args: "followers, days: 1, source: profile visits", result: "3,940 new followers from 2 quote-post threads\n71% arrive on the quote post" },
      { name: "write_report", icon: "file-text", args: "week: 1", result: "drafted, 7 lines\nheld for Monday" },
    ],
    note: "The account grows on other people's quote posts, not on the timeline, so the post that invites the quote is the one to post. Week one's report is drafted for Monday.",
  },
];

// the week's captions, in the shape the tests taught: the joke in the image,
// the caption only completing it, and never naming a private person
export const WEEK_TITLES = [
  "police report: possibly a monkey",
  "me at the function after one slice",
  "the gourd weighed 400 lbs and I felt that",
  "they found him and he was fine",
  "day 6 of the heat wave and I am the kinkajou",
  "the 20-toed cat showing all 20 toes",
  "one guy, one gourd, one county fair",
  "my guy said it might be a kangaroo",
  "the trash can was shelter, ok?",
  "the cat has 20 toes and no regrets",
  "nothing to see here, said the kinkajou",
  "summer, from behind a trash can",
  "still waiting on the animal control explanation",
  "the fair is over and the gourd is not",
  "he just needed somewhere cool to be",
  "20 toes and one very normal Tuesday",
  "every group chat has a kinkajou",
  "the county fair has one rule",
  "behind the pizza place, 1:53 p.m.",
  "the animal people describe as possibly both",
  "found: one animal, description loose",
];

// the real meme images the posts link to, on imgflip's own CDN
// (api.imgflip.com/get_memes). Each post wears one: the image is the real
// template the post was remade from, and the manifest names its source URL
const POST_IMAGES = [
  { file: "m01.jpg", url: "https://i.imgflip.com/30b1gx.jpg" }, // Drake Hotline Bling
  { file: "m02.jpg", url: "https://i.imgflip.com/3lmzyx.jpg" }, // UNO Draw 25 Cards
  { file: "m03.jpg", url: "https://i.imgflip.com/1ur9b0.jpg" }, // Distracted Boyfriend
  { file: "m04.jpg", url: "https://i.imgflip.com/22bdq6.jpg" }, // Left Exit 12 Off Ramp
  { file: "m05.jpg", url: "https://i.imgflip.com/1g8my4.jpg" }, // Two Buttons
  { file: "m06.jpg", url: "https://i.imgflip.com/3oevdk.jpg" }, // Bernie I Am Once Again Asking
];
export const POSTS = POST_IMAGES.map((p, i) => ({
  id: `1884${String(500000000000000 + i * 7717).slice(0, 15)}`,
  url: `https://x.com/${HANDLE.slice(1)}/status/1884${String(500000000000000 + i * 7717).slice(0, 15)}`,
  thumb: `thumbs/${p.file}`,
}));

// the first post as the user sees it: the generated clip, cut from the post's
// own image (the meme kid, re-rendered by the model, the caption landing on
// panel two). The browser window shows about six seconds of it
export const GENERATED = { file: "generated.mp4", seconds: 6 };

// the opening line, on the brand green before anything else is drawn
export const QUOTE = { text: "“Always deliver more than expected.”", by: "- Larry Page" };
// the sign-off: the mark, then the name
export const OUTRO = { logo: "dawn-mark.png", name: "DAWN" };

// where the numbers end up: the 14-day impressions curve, and the tiles at
// the close
export const VIEWS_CURVE = [0, 0, 0, 0, 0, 0, 0, 420, 1250, 3100, 7400, 16800, 39000, 86000];
export const FINAL = { subs: 21800, comments: 7400, watch: 9100, revenue: 640, sponsor: 0, adSpend: 0 };

// ---------- the script run.js plays ----------

// numbers.shapes: [lead, pow] per tile: a slow near-straight climb first,
// then the curve turns up and runs away, each number on its own lead and turn
const script = {
  id: DEMO_ID,
  title: TITLE,
  request: REQUEST,
  template: "channel",
  assets: ASSETS,
  shared: SHARED,
  quote: QUOTE,
  outro: OUTRO,
  plan: PLAN,
  thinking: THINKING,
  // the line above the plan card
  planSay: (title) => `Here is the plan for ${title}. It opens an X account under your own sign-in, posts three times a day from the day's odd news, and puts every caption through a policy check before it goes out. Change anything, or approve it and I start.`,

  // ---------- the account the goal needs ----------
  connect: {
    probe: "x",
    platform: "X",
    mark: "x",
    auth: "oauth2",
    title: "Connect X",
    url: "/api/connect/x/start",
    say: "Great, that is the plan. One thing from you: sign in to X once under your own account and I open the posting account under it. I keep the token, never the password.",
    statusOpening: "Opening the account",
    statusWaiting: "Waiting on the X sign-in",
    log: (account) => `X connected as ${account}`,
  },
  account: ACCOUNT,

  // ---------- the setup the goal needs, and the rail it lands on ----------
  // the checklist beside the chat is the sim's own (store.js setupSteps), so
  // its three ids stay what they are; the words are this goal's
  setup: {
    status: "Setting up the account",
    line: (c) => `Account open: **${c.channel}**, ${c.handle}, under ${c.account}. The numbers and the log are on the right. Posts go out at ${c.slots.join(", ")}; starting on the first one.`,
    log: (c) => `Account created: ${c.channel} (${c.handle})`,
    done: ["youtube", "card", "stripe"],
    summary: { youtube: `X account ${HANDLE}, ${ACCOUNT}`, card: "Visa ending 4242", stripe: "Stripe, connected" },
    account: ACCOUNT,
    channel: "News that memes",
    handle: HANDLE,
    slots: SLOTS,
    missions: [
      { id: "demo-first-post", title: "First post: the kinkajou", site: "X", url: "https://x.com", icon: "sparkles", progress: 41, steps: ["Reading the day's odd-news wire", "Opening the story and keeping the dated source", "Picking the template the line fits", "Regenerating the template image", "Passing the policy check and posting"] },
      { id: "demo-policy", title: "A policy check on every caption", site: "X", url: "https://x.com", icon: "shield-check", progress: 24, steps: ["Writing the check over caption and alt text", "Running it before the queue, never after", "Holding eleven captions that named a private person", "Logging every flag with the line that caused it"] },
      { id: "demo-format", title: "Three a day, three formats", site: "X", url: "https://x.com", icon: "layout-grid", progress: 8, steps: ["Reading the first post back at six hours", "Testing caption length, template family and aspect", "Switching the queue to the format that won", "Writing the Monday report"] },
    ],
    tool: { name: "create_account", icon: "x", args: `name: "News that memes", handle: ${HANDLE}, account: ${ACCOUNT}`, result: `created\nhandle: ${HANDLE}\nprofile art: uploaded, 3 variants kept` },
    // how far the rail's missions move at each beat of the story
    steps: { first: 24, upload: 28, more: 20, week: 27 },
  },

  // ---------- the first artifact, worked in full ----------
  work: FIRST_POST,
  workStatus: THINKING.first,
  workLog: "Read the wire, chose the template and ran the policy check",
  workSay: "The story is UPI, Aug. 24, and the caption is 62 characters: the joke lives in the image. I am generating four candidates over the Drake template now, then composing the 1:1 and posting the one that holds its shape at thumbnail size.",
  media: GENERATION,
  mediaNote: GENERATION_NOTE,
  mediaInsight: { kind: "insight", text: "nano-banana 2 keeps both faces; FLUX.1 schnell drops the panel that carries the joke", delta: 22 },
  voice: STING,
  voiceLog: "Sound picked, 1.2 s from trending audio",
  render: COMPOSE,
  // the post card and the published post it becomes
  upload: POST,
  artifact: (v, title, slot, length) => ({ url: v.url, thumb: `${ASSETS}/${v.thumb}`, title: `Posted: ${title}`, mark: X_MARK, meta: `x.com${v.url.slice(v.url.indexOf("/", 8))} · ${slot} · ${length}` }),
  liveSay: (title, url, slot) => `It is live: [${title}](${url}), posted for ${slot}. The 13:00 and 19:00 posts are already in the queue.`,
  status: { cutting: "Generating the 13:00 post", readingWeek: "Reading the week's numbers", waiting: "Waiting on the plan" },

  // ---------- the next artifacts, before the week ----------
  more: [
    { video: POSTS[1], title: WEEK_TITLES[1], slot: SLOTS[1], length: "1080×1350", gen: { name: "generate_image", icon: "sparkles", args: "model: nano-banana 2, template: UNO Draw 25", result: "done in 8 s" }, voice: { name: "write_caption", icon: "file-text", args: "38 characters, no date of birth", result: "written" }, numbers: 0.05 },
    { video: POSTS[2], title: WEEK_TITLES[2], slot: SLOTS[2], length: "1080×1080", gen: { name: "generate_image", icon: "sparkles", args: "model: nano-banana 2, template: Distracted Boyfriend", result: "done in 9 s" }, voice: { name: "check_policy", icon: "shield-check", args: "caption, alt text, source line", result: "no flags" }, numbers: 0.09 },
  ],
  moreStatus: (slot) => `Working on the ${slot} post`,
  weekIntro: "Three up on day one. From here I read every post back, run the tests two arms at a time, and switch the queue to whatever the reposts per thousand say. The policy check runs on every caption before it queues.",

  // ---------- the week ----------
  week: WEEK,
  videos: POSTS,
  titles: WEEK_TITLES,
  slots: SLOTS,
  // the week runs faster as it goes: five times at the start, eight by the
  // last day
  speeds: [5, 5, 5.5, 6, 6.5, 7, 8],
  weekStatus: (day, what) => `Day ${day}: ${what}`,
  weekUploadLengths: ["1080×1080", "1080×1350", "1080×1080"],

  // ---------- the numbers ----------
  numbers: {
    curve: VIEWS_CURVE,
    final: FINAL,
    // [lead, pow] per tile
    shapes: { views: [0.2, 3.4], watch: [0.2, 3.9], subs: [0.15, 4.4], comments: [0.12, 5], revenue: [0.08, 5.6] },
    // the rail tiles this goal needs, and how often each may be told to roll
    // (the ids are the channel template's own rail; the account's vocabulary
    // is X's, the rail's is the template's)
    tiles: [
      { id: "series", every: 260, read: "users", tell: "users" },
      { id: "subs", every: 200, read: "subs", tell: "stats" },
      { id: "watch", every: 340, read: "watch", tell: "stats" },
      { id: "comments", every: 390, read: "comments", tell: "stats" },
      { id: "revenue", every: 430, read: "revenue", tell: "revenue" },
    ],
    // the count passing a round number is worth a line in the log
    crossing: { step: 1000, read: "subs", kind: "follower", text: (thousands) => `Followers crossed ${thousands}k` },
    // the log reads the tiles' own numbers at the close of a day
    dayLine: (day, views) => `Day ${day}: ${views} impressions so far`,
    gainedLine: (gained) => `${gained} new followers today`,
  },

  // the demo's own clip, opened in the browser window
  generated: GENERATED,
};

export default script;