// demo/script.js: what the demo says and shows, scene by scene. Every
// screenshot and video here is a real capture under assets/demo/bears (see
// its manifest.json); the words are the agent's. run.js plays this in order.

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
  milestone: { title: "Voiceover recorded", text: "14 s · Adam · from the 138-word script", src: "voice.m4a" },
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
