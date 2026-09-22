// demo/scripts/climbing.js: the climbing goal, as data. This is the demo the
// product was designed against, transcribed verbatim from the old
// demo/script.js: every screenshot and video here is a real capture under
// assets/demo/bears (see its manifest.json); the words are the agent's.
// run.js plays it. Nothing in run.js knows this goal happened.
import { YOUTUBE_MARK } from "../../icons.js";

export const DEMO_ID = "new-project-hlug";
export const ASSETS = "assets/demo/bears";
// the generation and voice sites, captured once and shared
export const SHARED = "assets/demo";

export const REQUEST = "Make me a youtube channel that uploads videos of rock climbing near death experiences";
export const TITLE = "Climbing close calls";
export const CHANNEL = "Whipper";
export const HANDLE = "@whipperclimbing";
export const ACCOUNT = "ada@lovelace.co";

// the plan: the channel under the user's own Google sign-in, three uploads
// a day, the tests that find what the audience watches, and what it costs
export const PLAN = [
  { title: "Open the channel with your Google sign-in", detail: "One OAuth sign-in from you; the channel, its handle and its art are created under your account and the token is kept, never a password." },
  { title: "Upload three videos a day", detail: "06:00, 12:00 and 18:00 local. Each one is scripted, generated, voiced, captioned and scheduled from a queue that is always two videos ahead." },
  { title: "A/B test what wins", detail: "Content angle (caught falls, free solo, storms, rescues), length (45 s short, 3 min, 8 min), generation model (Veo 3, Kling 2.1, Runway Gen-4) and which channels to model on; two arms at a time, decided on watch time." },
  { title: "Estimated cost: about $4.10 a video", detail: "$3.20 generation, $0.60 voice, $0.30 thumbnails and captions. Three a day is about $370 a month, plus ads only if you turn them on." },
  { title: "Report every Monday", detail: "Subscribers, views, watch hours, the arm that won each test and the one change for next week." },
];

export const THINKING = {
  request: ["Reading the brief: one niche, a channel to create, uploads on a schedule", "Checking what the climbing channels already win on before I plan the length", "Costing three videos a day across the generation models"],
  first: ["Searching YouTube for the channels that already win this niche", "Reading two channels for length, pacing and upload cadence", "Writing the first script from what the top videos share", "Generating the wall scene in three models to pick one", "Recording the voiceover", "Rendering and uploading the first video"],
};

// the first video, worked in full: every tool call, the note it leaves,
// and the screenshot it took. A shot is what the agent was looking at
export const FIRST_VIDEO = [
  { tool: { name: "search_youtube", icon: "search", args: 'query: "climbing near death caught on camera", sort: views', result: "12 results\ntop: 9.9M views, 3.2M, 285K\n8 of 12 lead with the fall: the hold breaks, the catch" }, shot: { file: "yt-search.png", caption: "YouTube search: climbing near death caught on camera" }, note: "The top results put the fall in the title and the wall in the thumb. A close call is a story, and stories get followed." },
  { tool: { name: "open_channel", icon: "compass", args: "@ClimbingMagic", result: "8.35k subscribers, 27 videos\nfalls, fails and whippers, 3 to 12 min\n8.6M views on the biggest compilation" }, shot: { file: "yt-inspo-1.png", caption: "Inspiration channel A: Climbing Magic" }, note: "Channel A: fall compilations, 3 to 12 minutes, years of them. The compilation is the retention arm." },
  { tool: { name: "open_channel", icon: "compass", args: "@fatallycurious", result: "59.9k subscribers, 166 videos\none narrator over disasters and near misses, 10 to 20 min\nweekly uploads" }, note: "Channel B: one narrator over one close call at a time. The story arm. Test both." },
  { tool: { name: "read_channel_stats", icon: "activity", args: "channel: @ClimbingMagic, window: 90d", result: "1.4M views in 90 days\nviews/day: 14k avg, 98k on upload days\ncomments per 1k views: 9" }, note: "Upload days do 7× the views of quiet days. Three a day keeps the channel on an upload day every day." },
  { tool: { name: "write_script", icon: "file-text", args: "length: 3 min, angle: the fall, told in the first person", result: "138 words\nopen on the hold starting to crack, first line under 4 s\n4 scenes: the wall, the break, the fall, the trees" }, note: "Script opens on the hold starting to crack and reaches the catch in the first four seconds. No intro." },
];

export const GENERATION = [
  { tool: { name: "generate_video", icon: "clapperboard", args: "model: Veo 3, scene: the wall, 8 s", result: "done in 41 s\nthe rock reads real, his hands stay steady" }, shot: { file: "gen-veo.png", shared: true, caption: "Veo 3: generating scene 1, the wall" } },
  { tool: { name: "generate_video", icon: "clapperboard", args: "model: Kling 2.1, scene: the wall, 8 s", result: "done in 58 s\nhis feet drift on the pan" }, shot: { file: "gen-kling.png", shared: true, caption: "Kling 2.1: the same scene, for the comparison" } },
  { tool: { name: "generate_video", icon: "clapperboard", args: "model: Runway Gen-4, scene: the break, 8 s", result: "done in 33 s\nclose-up of the hold snapping holds" } },
];
export const GENERATION_NOTE = "Veo keeps the rock and the hands right on the wide shots; Runway wins the close-up of the hold breaking. Kling is out for this niche.";

export const VOICE = {
  tool: { name: "generate_voice", icon: "mic", args: "voice: Adam, 138 words", result: "13.6 s\npeak -1.2 dB, no clipping" },
  shot: { file: "voice-eleven.png", shared: true, caption: "ElevenLabs: recording the voiceover" },
  milestone: { title: "Voiceover recorded", text: "14 s · Adam · from the 138-word script", src: "voice.m4a", icon: "mic", media: "audio", mediaTitle: "Voiceover" },
};

export const RENDER = { name: "render", icon: "clapperboard", args: "1080p, 4 scenes, voice + captions", result: "3:02\n1080p60, 48 kHz\nthumbnail: frame 0:19, the catch, title in 3 words" };
export const UPLOAD = (title, slot = "06:00") => ({ name: "upload_video", icon: "youtube", args: `title: "${title}", schedule: ${slot}`, result: "published\nvisibility: public\nchapters: 4" });

// the schedule slots the three uploads go out in
export const SLOTS = ["06:00", "12:00", "18:00"];

// the montage: a week of learning at five times speed. Each day is a few
// tool calls and the note the day taught, then its three uploads
export const WEEK = [
  { day: 2, tools: [{ name: "read_retention", icon: "activity", args: "video: 1, window: 60 s", result: "drop at 0:22: -11%\nthe build-up runs long" }, { name: "read_experiment", icon: "compass", args: "test: length-1", result: "45 s: 2.4× watch time per view\n3 min: 4.1× minutes per upload" }], note: "Both lengths earn: shorts for reach, the 3-minute fall for watch time. Two shorts and one long a day." },
  { day: 3, tools: [{ name: "set_thumbnail", icon: "image", args: "test: thumb-2, variant: B", result: "B: 8.4% ctr vs A: 5.1%\nconfidence 0.95" }, { name: "read_comments", icon: "mail", args: "since: 24 h", result: "418 comments\n96 ask if he is okay\n\"what broke\" ×41" }], note: "The caught-in-the-trees thumbnail wins by more than half. Every description now names what broke and how high in line one." },
  { day: 4, tools: [{ name: "read_experiment", icon: "compass", args: "test: model-2", result: "Veo: 73% avg view\nRunway: 68%\nKling: 49%" }, { name: "set_model", icon: "sliders-vertical", args: "wide: Veo 3, close: Runway Gen-4", result: "applied to the queue" }], note: "Veo wins the wide shots on retention, Runway the close-ups. Kling retired from the rotation." },
  { day: 5, tools: [{ name: "read_watch_time", icon: "activity", args: "by: hour, days: 4", result: "peak: 19:00 to 23:00\n06:00 slot: 28% of peak" }, { name: "set_schedule", icon: "calendar-clock", args: "slots: 07:30, 12:30, 19:00", result: "applied from tomorrow" }], note: "The audience is awake in the evening. The long fall moves to 19:00; shorts take the morning." },
  { day: 6, tools: [{ name: "read_traffic", icon: "compass", args: "source: shorts feed, days: 5", result: "shorts feed: 71% of new subscribers\nsearch: 17%\nsuggested: 12%" }, { name: "post_reply", icon: "check", args: "answer: what broke and how he is, count: 96", result: "posted: 96" }], note: "Seven in ten new subscribers come in through the shorts feed and stay for the long fall. That is the funnel." },
  { day: 7, tools: [{ name: "read_experiment", icon: "compass", args: "test: angle-1", result: "caught falls: 8.6% ctr\nfree solo: 7.9%\nrescues: 6.2%" }, { name: "write_report", icon: "file-text", args: "week: 1", result: "drafted, 6 lines\nheld for Monday" }], note: "Caught falls beat free solo in this niche, and both beat rescues. Week one report is drafted for Monday." },
];

// the week's uploads: titles in the shape the search results taught us —
// the fall in the title, the wall in the thumbnail
export const WEEK_TITLES = ["The hold broke and the trees caught him", "Free solo at 1,200 feet, no rope, 45 s", "He fell past the wall and a tree saved him", "Whiteout on the ridge, the full storm", "The eagle went for his helmet, 45 s", "That crimp was never going to hold", "He rappelled off the end of the rope", "The ledge went, and he went with it", "One arm over the void, 45 s", "Lightning on the exposed ridge", "The ice wall let go beside him", "Fingertips on a sloper, feet in the air", "Bivied on a ledge the size of a plate", "The longest whipper of his season, 45 s", "Crossing the knife edge in cloud", "Rockfall in the gully, 45 s", "Soloing above the clouds", "The cam ripped and he kept the rack", "Sixty feet up with one hand, 45 s", "The tree that saved his life", "The catch, frame by frame"];


// the real videos the uploads link to (assets/demo/bears/manifest.json,
// all 21 checked against YouTube's oEmbed). Each upload wears a thumbnail
// the agent made: the clicked one is a real photograph; the other twenty
// are stills generated on fal.ai with nano-banana-2 from the prompts in
// thumb-prompts.txt, judged by an external subagent over two rounds until
// no two were alike, none carried text and none read as AI
const VIDEO_IDS = ["1ac7tKe0QXc", "LAOcsbEqlWY", "VykqqONDFO8", "nze_Ewz1DYE", "SfQIyxA6gIc", "xPV9vxOZszI", "GkDa6sZ-alg", "TMtFKHBmIR4", "YpCwqgzBnoc", "2v5t6oCyWWQ", "GdDDAXxiE3s", "DsIAgqavjyc", "pqXAsXiTXY0", "66KF_5JWpdA", "5Lvcc28OSVc", "Q92X1zpaB3w", "yR17BgK8LfE", "ZEge7MsOq8U", "pxV_j1Pq7VU", "Ci6fcOl3MlQ", "tTSb-07rXlk"];
export const VIDEOS = VIDEO_IDS.map((id, i) => ({ id, url: `https://www.youtube.com/watch?v=${id}`, thumb: `thumbs/gen-${String(i + 1).padStart(2, "0")}.jpg` }));

// the first upload as the user sees it: a clip generated on fal.ai (Kling
// 3 Pro, image-to-video) that starts on the upload's own thumbnail, the
// climber reaching on the wall, the hold snaps and he drops into the
// crown of a tree that catches him; the storyboard is beside it in
// generated-prompt.txt. The browser window shows about five seconds of it
export const GENERATED = { file: "generated.mp4", seconds: 7 };

// the opening line, on the brand green before anything else is drawn
export const QUOTE = { text: "“Always deliver more than expected.”", by: "- Larry Page" };
// the sign-off: the mark, then the name
export const OUTRO = { logo: "dawn-mark.png", name: "DAWN" };

// where the numbers end up: the 14-day views curve the graph climbs to,
// and the tiles at the close
export const VIEWS_CURVE = [0, 0, 0, 0, 0, 0, 0, 210, 640, 1500, 3800, 9200, 21000, 48000];
export const FINAL = { subs: 12400, comments: 3900, watch: 6100, revenue: 1840, sponsor: 0, adSpend: 0 };

// ---------- the script run.js plays ----------

// the play(): every beat of the run, as data. Nothing here is read except
// through the player, so a new goal is a new file, never a new branch.
//
// numbers.shapes: [lead, pow] per tile, the shape a number grows in over
// the week (a slow, near-straight climb first, then the curve turns up and
// runs away). Each number has its own lead and turn, so the tiles never
// move in step.
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
  planSay: (title) => `Here is the plan for ${title}. It opens the channel under your own Google sign-in, keeps three uploads a day, and tests its way to what the audience watches. Change anything, or approve it and I start.`,

  // ---------- the account the goal needs ----------
  connect: {
    probe: "google",
    platform: "YouTube",
    mark: "youtube",
    auth: "oauth2",
    title: "Connect YouTube",
    url: "/api/connect/google/start",
    say: "Great, that is the plan. One thing from you: sign in to YouTube once with your Google account and I open the channel under it. I keep the token, never the password.",
    statusOpening: "Opening the channel",
    statusWaiting: "Waiting on Google sign-in",
    log: (account) => `YouTube connected as ${account}`,
  },
  account: ACCOUNT,

  // ---------- the setup the goal needs, and the rail it lands on ----------
  setup: {
    status: "Setting up the channel",
    line: (c) => `Channel open: **${c.channel}**, ${c.handle}, under ${c.account}. The numbers and the log are on the right. Uploads go out at ${c.slots.join(", ")}; starting on the first one.`,
    log: (c) => `Channel created: ${c.channel} (${c.handle})`,
    done: ["youtube", "card", "stripe"],
    summary: { youtube: `Channel ${CHANNEL}, ${ACCOUNT}`, card: "Visa ending 4242", stripe: "Stripe, connected" },
    account: ACCOUNT,
    channel: CHANNEL,
    handle: HANDLE,
    slots: SLOTS,
    missions: [
      { id: "demo-first-video", title: "First video: the hold breaks", site: "YouTube Studio", url: "https://studio.youtube.com", icon: "clapperboard", progress: 38, steps: ["Writing the script from the wall footage", "Generating the crag scene in three models", "Recording the voiceover", "Rendering and uploading the 06:00 video"] },
      { id: "demo-thumbs", title: "Thumbnail tests on the fall footage", site: "YouTube Studio", url: "https://studio.youtube.com", icon: "image", progress: 16, steps: ["Pulling three frames from the crag clip", "Cutting the caught fall into the corner", "Scoring each against the last upload", "Switching the queue to the winner"] },
      { id: "demo-schedule", title: "Three uploads a day, on the hour", site: "YouTube Studio", url: "https://studio.youtube.com", icon: "calendar-clock", progress: 0, steps: ["Reading the first video's watch time by hour", "Placing the 06:00, 12:00 and 18:00 slots", "Writing the descriptions and tags", "Scheduling tomorrow's three"] },
    ],
    tool: { name: "create_channel", icon: "youtube", args: `name: "${CHANNEL}", handle: ${HANDLE}, account: ${ACCOUNT}`, result: `created\nhandle: ${HANDLE}\nart: uploaded, 3 variants kept` },
    // how far the rail's missions move at each beat of the story
    steps: { first: 22, upload: 30, more: 18, week: 26 },
  },

  // ---------- the first artifact, worked in full ----------
  work: FIRST_VIDEO,
  workStatus: THINKING.first,
  workLog: "Read the two inspiration channels and wrote script 1",
  workSay: "Script is 138 words and opens on the climber reaching for the hold. Generating the crag scene in three models to see which one looks real, then the voice.",
  media: GENERATION,
  mediaNote: GENERATION_NOTE,
  mediaInsight: { kind: "insight", text: "Veo 3 keeps the hands and the rock right; Kling lets the feet drift", delta: 19 },
  voice: VOICE,
  voiceLog: "Voiceover recorded, 14 s",
  render: RENDER,
  // the first artifact's own length, on its own card and in the log line
  firstLength: "3:04",
  // the activity-log kinds this goal's lines are filed under, so a store's
  // orders never land under a channel's "video" tab
  logs: { upload: "video", day: "view", delta: "subscriber" },
  // the upload card and the published artifact it becomes
  upload: UPLOAD,
  artifact: (v, title, slot, length) => ({ url: v.url, thumb: `${ASSETS}/${v.thumb}`, title: `Uploaded: ${title}`, mark: YOUTUBE_MARK, meta: `youtube.com/watch?v=${v.id} · ${slot} · ${length}` }),
  liveSay: (title, url, slot) => `It is live: [${title}](${url}), scheduled for ${slot}. The 12:00 and 18:00 videos are already in the queue.`,
  status: { cutting: "Cutting the 12:00 short", readingWeek: "Reading the week's numbers", waiting: "Waiting on the plan" },

  // ---------- the next artifacts, before the week ----------
  more: [
    { video: VIDEOS[1], title: WEEK_TITLES[1], slot: SLOTS[1], length: "0:45", gen: { name: "generate_video", icon: "clapperboard", args: "model: Veo 3, scenes: 1", result: "done in 36 s" }, voice: { name: "generate_voice", icon: "mic", args: "38 words", result: "9.1 s" }, numbers: 0.04 },
    { video: VIDEOS[2], title: WEEK_TITLES[2], slot: SLOTS[2], length: "4:12", gen: { name: "generate_video", icon: "clapperboard", args: "model: Runway Gen-4, scenes: 3", result: "done in 1:52" }, voice: { name: "generate_voice", icon: "mic", args: "155 words", result: "41 s" }, numbers: 0.08 },
  ],
  moreStatus: (slot) => `Working on the ${slot} upload`,
  weekIntro: "Three up on day one. From here I run the tests: length, model and thumbnail, two arms at a time, and switch the queue to whatever wins.",

  // ---------- the week ----------
  week: WEEK,
  videos: VIDEOS,
  titles: WEEK_TITLES,
  slots: SLOTS,
  // the week runs faster as it goes: five times at the start, eight by the
  // last day
  speeds: [5, 5, 5.5, 6, 6.5, 7, 8],
  weekStatus: (day, what) => `Day ${day}: ${what}`,
  weekUploadLengths: ["3:10", "0:45", "6:48"],

  // ---------- the numbers ----------
  numbers: {
    curve: VIEWS_CURVE,
    final: FINAL,
    // the rail tiles' own counters: each is carried toward its closing
    // number by its own shape. A goal names its own (orders, conversions),
    // so the rail measures what THAT goal is paid for
    stats: { subs: FINAL.subs, comments: FINAL.comments, watch: FINAL.watch },
    // [lead, pow] per tile
    shapes: { views: [0.2, 3.4], watch: [0.2, 3.9], subs: [0.15, 4.4], comments: [0.12, 5], revenue: [0.08, 5.6] },
    // the rail tiles this goal needs, and how often each may be told to roll
    tiles: [
      { id: "series", every: 260, read: "users", tell: "users" },
      { id: "subs", every: 200, read: "subs", tell: "stats" },
      { id: "watch", every: 340, read: "watch", tell: "stats" },
      { id: "comments", every: 390, read: "comments", tell: "stats" },
      { id: "revenue", every: 430, read: "revenue", tell: "revenue" },
    ],
    // the count passing a round number is worth a line in the log
    crossing: { step: 2000, read: "subs", kind: "subscriber", text: (thousands) => `Subscribers crossed ${thousands}k` },
    // the log reads the tiles' own numbers at the close of a day
    dayLine: (day, views) => `Day ${day}: ${views} views so far`,
    gainedLine: (gained) => `${gained} new subscribers today`,
  },

  // the demo's own clip, opened in the browser window
  generated: GENERATED,
  // the address the browser window frames when the clip is not on disk
  embedUrl: (id) => `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&rel=0&modestbranding=1`,
};

export default script;