// demo/scripts/discordbot.js: the Discord bot goal, as data. The goal is one
// bot in one guild with three jobs: welcome a new member, keep the links
// spam-free, and post the day's digest at 09:00. The bot is installed from
// the Discord developer portal (one authorize screen, two scopes), it answers
// a slash command inside the guild, and everything after that is an event the
// gateway pushes rather than something the platform polls.
//
// run.js plays it; nothing in run.js knows this goal happened. The screenshots
// are real captures of discord.com (see assets/demo/discord-bot/manifest.json
// for each one's source url and capture time); the guild-side shots and the
// digest voice note are produced by assets/demo/discord-bot/capture.mjs, which
// needs a signed-in Discord session and is documented in the same manifest.
//
// The platform's own numbers: credits are 10,000 to the dollar and an account
// carries a 2x markup on real cost (server/billing/money.js CREDITS_PER_DOLLAR
// and DEFAULT_MARKUP), which is what the plan's cost line is built on.

export const DEMO_ID = "discord-bot";
export const ASSETS = "assets/demo/discord-bot";
// the generation site and the brand mark, captured once and shared
export const SHARED = "assets/demo";

export const REQUEST = "Make me a discord bot for my server that welcomes new members, moderates spam and posts a daily digest";
export const TITLE = "Guild bot";
export const GUILD = "Sunset Founders";
export const BOT = "Lobby";
export const ACCOUNT = "ada@lovelace.co";

// the plan: three jobs in one bot, the consent screen that installs it, and
// what a month of it costs at the platform's own rate
export const PLAN = [
  { title: "Install the bot in Sunset Founders", detail: "One authorize screen from you: the bot joins with bot and applications.commands and nothing else, so it can only do what the guild ticked. Its own token is kept, never your password." },
  { title: "Welcome a new member in the first second", detail: "The member-join event fires, the bot posts one message in #general that names what the server is for, and no DM follows it." },
  { title: "Keep the links spam-free", detail: "A rule on the message event: the same invite three times inside ten minutes comes out, the author is warned once, and every removal is logged in #mod-log with the rule it broke." },
  { title: "A digest every day at 09:00", detail: "Overnight messages by channel, who joined and who left, the one thread worth reading, and the digest read aloud for the members who listen rather than read. One message in #general, no pings." },
  { title: "Estimated cost: about $3 a month", detail: "Under 1,000 credits a day: the welcome and the digest are cheap model calls and the spam rule is local. At the platform's 10,000 credits to the dollar that is about $1.50 of real work, billed at $3 with the account's markup. Discord itself charges nothing for the bot." },
];

export const THINKING = {
  request: ["Reading the brief: three jobs, one guild, one bot", "Checking which gateway events a Discord app may read without privileged intents", "Costing a month of messages against the credit rate"],
  first: ["Creating the application and its bot user", "Installing the bot in Sunset Founders", "Registering the /hello command in the guild", "Reading #introductions for the voice the welcome should use", "Writing the first AutoMod rule from what the spam actually did", "Scheduling the 09:00 digest"],
};

// the first pass, worked in full: every call, the note it leaves, and the
// screenshot the agent was looking at when it made it. The two shots here are
// public developer-portal pages; the guild shots land on the same beat of the
// story and are on disk once the capture pass has a signed-in session
export const FIRST_PASS = [
  { tool: { name: "create_app", icon: "layout-grid", args: 'name: "Lobby", team: none, bot user: on', result: "app created\nbot user: Lobby\nintents: guild members, guild messages" }, shot: { file: "portal-quickstart.png", caption: "Discord Developer Portal: creating the application and its bot user" }, note: "The app, the bot user and the token sit on one page. A welcome needs the member intent and the spam rule needs message content; nothing else is asked for, so the consent screen stays two scopes wide." },
  { tool: { name: "install_bot", icon: "download", args: `guild: ${GUILD}, scopes: bot, applications.commands`, result: `authorized by ${ACCOUNT}\njoined: ${GUILD}\nmembers: 412` }, shot: { file: "guild-install.png", caption: `Discord: the authorize screen that installs the bot in ${GUILD}` }, note: "One screen, two scopes, no administrator. The bot can read the join event and the messages it is asked to moderate, and nothing else in the guild." },
  { tool: { name: "register_command", icon: "command", args: 'name: /hello, description: "what this bot does in this server"', result: `registered: /hello\nscope: guild ${GUILD}\n1 command live` }, shot: { file: "bot-commands.png", caption: "Discord Developer Portal: application commands" }, note: "Registered to the guild rather than globally, so the command is live in seconds instead of up to an hour." },
  { tool: { name: "read_channel", icon: "file-text", args: "channel: #introductions, last: 60", result: "the same three asks: the Thursday meetup, the job board, the archive\nidiom: short lines, no hello back" }, note: "The welcome has to sound like this server, not like a form letter: it points at the three things people actually come for and stops." },
  { tool: { name: "run_command", icon: "check", args: `guild: ${GUILD}, channel: #general, command: /hello`, result: "/hello answered in 0.9 s\nLobby: \"I welcome new members, keep the links spam-free and post the 09:00 digest. /help lists the four things I can do.\"\n3 members replied" }, shot: { file: "guild-command.png", caption: "Discord: /hello answered in #general" }, note: "It answered in the channel it was asked in, in under a second, with what it does rather than a link to the docs. That is the whole install story: the command is the proof the bot is really in the guild." },
  { tool: { name: "read_channel", icon: "file-text", args: "channel: #general, last: 200", result: "18 messages from 2 accounts\nall the same invite, one every 40 s" }, note: "Two accounts posted one invite eighteen times in eleven minutes. That is the rule to write: repetition, not a word list." },
];

export const RULES = [
  { tool: { name: "set_welcome", icon: "mail", args: "channel: #general, trigger: member join, template: 3 lines", result: "saved\nposted on the next join, 0.4 s" }, shot: { file: "guild-welcome.png", caption: "Discord: the first welcome the bot posted" } },
  { tool: { name: "set_automod_rule", icon: "shield-check", args: "trigger: same link 3x in 10 min, action: remove, warn the author once, log: #mod-log", result: "rule live\n18 messages removed\n2 authors warned" }, shot: { file: "guild-spam.png", caption: "Discord: the removed spam and the mod-log line it left" } },
  { tool: { name: "schedule_digest", icon: "calendar-clock", args: "channel: #general, at: 09:00 daily, sections: joined, left, top thread", result: "scheduled\nfirst post in 9 h" }, shot: { file: "guild-digest.png", caption: "Discord: #general, the first 09:00 digest" } },
];
export const RULES_NOTE = "The welcome hangs off the join event, the spam rule off the message event, the digest off a 09:00 timer. All three run inside the guild; the platform polls nothing and holds no session open.";

// the digest read aloud, posted as a voice note beside the message. The audio
// is not synthesised in this sandbox (speech synthesis writes 0 bytes under
// the seatbelt sandbox), so digest-voice.m4a is owed by the capture pass —
// assets/demo/discord-bot/capture.mjs generates it from the 44-word summary
// below and records it in the manifest with its capture time
export const VOICE = {
  tool: { name: "generate_voice", icon: "mic", args: "summary: 44 words, voice: Adam", result: "17.4 s\npeak -1.4 dB, no clipping" },
  shot: { file: "voice-eleven.png", shared: true, caption: "ElevenLabs: the digest read aloud, for the members who listen rather than read" },
  milestone: { title: "Digest voice note recorded", text: "17 s · Adam · from the 44-word digest", src: "digest-voice.m4a", icon: "mic", media: "audio", mediaTitle: "Daily digest, read aloud" },
};

export const DEPLOY = { name: "deploy", icon: "zap", args: "runtime: hosted, region: local, restart: on crash", result: `live\n1 guild, 412 members\nrestarts: 0` };
export const POST = (title, slot = "09:00") => ({ name: "post_digest", icon: "mail", args: `channel: #general, headline: "${title}", at: ${slot}`, result: "sent\n1 message\n0 pings" });

// the digest goes out once a day, at the hour the server is quiet
export const SLOTS = ["09:00"];

// the montage: a week of the bot learning this server at five times speed.
// Each day is a few calls and the note the day taught, then the morning digest
export const WEEK = [
  { day: 2, tools: [{ name: "read_member_joins", icon: "user", args: "window: 24 h, source: invite", result: "joined: 41\nlargest invite: the Thursday meetup, 26" }, { name: "read_reactions", icon: "activity", args: "message: the welcome, window: 24 h", result: "replies: 19\nmost common: \"see you Thursday\"" }], note: "Twenty-six of forty-one arrivals came in on the meetup invitation, and the template line people answer is the one naming Thursday. The welcome now names the meetup and nothing else." },
  { day: 3, tools: [{ name: "read_mod_log", icon: "shield-check", args: "window: 24 h", result: "removed: 22\nfalse positives: 2 of 22\nboth from one member sharing the archive link" }, { name: "set_rule_exception", icon: "sliders-vertical", args: "allow: archive.example.com, frequency: unlimited", result: "applied" }], note: "Two removals were the archive link the server shares daily. The rule exempts that host and nothing else; the spam count drops to the messages that were actually repeated." },
  { day: 4, tools: [{ name: "read_digest", icon: "file-text", args: "day: 3, sections: opened, read, muted", result: "open rate: 61%\nthe mod-log section is read by 9%" }, { name: "set_digest_section", icon: "sliders-vertical", args: "drop: mod-log, add: unanswered questions", result: "digest now 4 sections" }], note: "Three in five open the digest and almost nobody reads the mod-log line in it. That section came out and the unanswered questions went in." },
  { day: 5, tools: [{ name: "read_activity", icon: "activity", args: "channel: #general, by: hour, days: 4", result: "quietest: 08:00\npeak: 21:00 to 23:00" }, { name: "set_schedule", icon: "calendar-clock", args: "digest: 08:00", result: "applied from tomorrow" }], note: "The server is asleep at nine and awake at eleven at night, so the digest moved to the hour nobody is mid-conversation." },
  { day: 6, tools: [{ name: "read_welcome", icon: "user", args: "window: 5 days", result: "welcomed: 288\nreplied: 154 (53%)\nDM opt-outs: 0" }, { name: "set_welcome_line", icon: "sliders-vertical", args: "add: \"the archive is pinned in #resources\"", result: "applied" }], note: "Half of the people the bot welcomes answer it in the channel. Adding the pinned-archive line moved the first question from the moderators to the bot." },
  { day: 7, tools: [{ name: "read_rule", icon: "shield-check", args: "window: 7 days", result: "removed: 96\nwarned: 7\nrepeat authors: 1\nescalated: 0" }, { name: "write_report", icon: "file-text", args: "week: 1", result: "drafted, 6 lines\nheld for Monday" }], note: "Ninety-six messages out, seven warnings, one account twice, nothing escalated. Week one report is drafted for Monday." },
];

// the digest headlines: what the bot posts at 09:00, in the register this
// server reads — one number, one thread, one ask
export const HEADS = [
  "6 joined, the meetup thread went 40 replies long",
  "4 joined, one left, the job board got its first post",
  "9 joined on the meetup invite, 2 removed from #general",
  "3 joined, the archive link was shared 11 times and kept",
  "5 joined, the digest moved to 08:00 tomorrow",
  "2 joined, 14 questions answered, 1 left unanswered",
  "7 joined, the meetup filled its last 6 seats",
  "1 joined, 2 removed, one account warned twice",
  "4 joined, the mod-log was read by 9% so it left the digest",
  "6 joined, the pinned archive answered 8 first questions",
  "3 joined, 0 removed, the quietest spam day of the week",
  "8 joined on the meetup invite, the last 3 seats went",
  "2 joined, 1 left, 22 removed from #general overnight",
  "5 joined, the welcome template got its 300th reply",
  "4 joined, the job board post is the second most-read message",
  "1 joined, 96 removed this week, 7 warned, 0 escalated",
  "6 joined, the digest open rate held at 61%",
  "3 joined, 2 accounts timed out by the rule for repeat invites",
];

// the digest as the user sees it: the message card opens the guild's own
// channel list, which is where the bot posted it
const DIGESTS = ["day-1", "day-2", "day-3", "day-4", "day-5", "day-6", "day-7", "day-8", "day-9", "day-10", "day-11", "day-12", "day-13", "day-14", "day-15", "day-16", "day-17", "day-18"];
export const MESSAGES = DIGESTS.map((id) => ({ id, url: "https://discord.com/channels/@me", meta: "discord.com/channels/@me" }));

// the run's own clip: the bot answering /hello in the guild, recorded by the
// capture pass (assets/demo/discord-bot/capture.mjs). Until that file is on
// disk the browser window falls back to the embed the player builds
export const GENERATED = { file: "guild-command.mp4", seconds: 9 };

// the opening line, on the brand green before anything else is drawn
export const QUOTE = { text: "“Make something people want.”", by: "- Paul Graham" };
// the sign-off: the mark, then the name
export const OUTRO = { logo: "dawn-mark.png", name: "DAWN" };

// the guild's activity over 14 days: messages the bot read and answered, the
// graph the goal grows (every count here starts at zero on the day the bot
// was installed, which is why the headline graph is activity and not the
// member count the guild already had)
export const ACTIVITY = [0, 0, 0, 0, 0, 0, 0, 0, 180, 420, 960, 2100, 4300, 6800];
// subs here is the week's welcomes: the only "arrival" count the bot owns
export const FINAL = { subs: 412, comments: 12400, watch: 312, revenue: 6, sponsor: 0, adSpend: 0 };

// ---------- the script run.js plays ----------

// numbers.shapes: [lead, pow] per count, the shape a number grows in over the
// week (a slow, near-straight climb first, then the curve turns up and runs
// away). The bot's own counters: messages read, spam removed, welcomes sent,
// the digest's own number, and the month's bill
const script = {
  id: DEMO_ID,
  title: TITLE,
  request: REQUEST,
  template: "pipeline",
  assets: ASSETS,
  shared: SHARED,
  quote: QUOTE,
  outro: OUTRO,
  plan: PLAN,
  thinking: THINKING,
  // the line above the plan card
  planSay: (title) => `Here is the plan for ${title}. It installs one bot in ${GUILD} under your own Discord authorization, and it does three things: welcome a new member, keep the links spam-free, and post the day's digest at 09:00. Change anything, or approve it and I install it.`,

  // ---------- the account the goal needs ----------
  connect: {
    probe: "discord",
    platform: "Discord",
    // icons.js carries no Discord mark yet: the set's own command glyph is
    // what the popup draws (a brand SVG the provider did not draw itself
    // would be worse than a neutral one). Adding the provider's own mark to
    // BRAND_MARKS is a change in src/icons.js, outside this goal's files.
    mark: "command",
    auth: "oauth2",
    title: "Connect Discord",
    url: "/api/connect/discord/start",
    say: `Great, that is the plan. One thing from you: authorize ${BOT} in your Discord account once. You pick the guild and the two scopes on Discord's own screen; I keep the token, never the password, and I never hold administrator.`,
    statusOpening: "Installing the bot",
    statusWaiting: "Waiting on Discord authorization",
    log: (account) => `Discord connected as ${account}`,
  },
  account: ACCOUNT,

  // ---------- the setup the goal needs, and the rail it lands on ----------
  setup: {
    status: "Installing the bot",
    line: (c) => `Bot installed: **${BOT}** in **${c.guild}**, authorized by ${c.account}. ${c.members} members, #general and #mod-log reachable. The digest goes out at ${c.slots.join(", ")}; the first one is queued.`,
    log: (c) => `Bot installed: ${BOT} in ${c.guild}`,
    done: ["discord", "card"],
    summary: { discord: `Bot ${BOT} in ${GUILD}`, card: "Visa ending 4242" },
    account: ACCOUNT,
    guild: GUILD,
    bot: BOT,
    members: 412,
    slots: SLOTS,
    missions: [
      { id: "demo-install", title: "Install Lobby in Sunset Founders", site: "Discord Developer Portal", url: "https://discord.com/developers/applications", icon: "command", progress: 22, steps: ["Create the application and the bot user", "Authorize the bot and applications.commands scopes", "Register /hello to the guild", "Confirm the bot is in the member list"] },
      { id: "demo-welcome", title: "The welcome line, and the spam rule", site: "Discord", url: "https://discord.com/channels/@me", icon: "shield-check", progress: 8, steps: ["Read #introductions for the server's own voice", "Write the three-line welcome", "Rule out repeated invites, log to #mod-log", "Check the first ten joins against it"] },
      { id: "demo-digest", title: "The 09:00 digest", site: "Discord", url: "https://discord.com/channels/@me", icon: "calendar-clock", progress: 0, steps: ["Count overnight messages by channel", "Draft the four sections", "Read it aloud for the listeners", "Schedule it for 09:00"] },
    ],
    tool: { name: "install_bot", icon: "download", args: `guild: ${GUILD}, scopes: bot, applications.commands, account: ${ACCOUNT}`, result: `authorized\njoined: ${GUILD}\nmembers: 412\n#general, #mod-log: readable` },
    // how far the rail's missions move at each beat of the story
    steps: { first: 22, upload: 30, more: 18, week: 26 },
  },

  // ---------- the first artifact, worked in full ----------
  work: FIRST_PASS,
  workStatus: THINKING.first,
  workLog: "Created the app, installed the bot, registered /hello and read #introductions",
  workSay: `The bot is in ${GUILD} and /hello answers in #general in under a second. I read sixty introductions to get the welcome's voice right; writing the three rules it needs now.`,
  media: RULES,
  mediaNote: RULES_NOTE,
  mediaInsight: { kind: "insight", text: "26 of 41 arrivals came on one invitation, so the welcome names the meetup", delta: 26 },
  voice: VOICE,
  voiceLog: "Digest voice note recorded, 11 s",
  render: DEPLOY,
  // the message card and the message it becomes in the guild
  upload: POST,
  artifact: (v, title, slot) => ({ url: v.url, title: `Posted: ${title}`, meta: `${v.meta} · ${GUILD} · ${slot}` }),
  liveSay: (title, url, slot) => `It is live: [${title}](${url}) in #general, scheduled for ${slot}. Tomorrow's is already in the queue.`,
  status: { cutting: "Writing tomorrow's digest", readingWeek: "Reading the week's numbers", waiting: "Waiting on the plan" },

  // ---------- the next artifacts, before the week ----------
  more: [
    { video: MESSAGES[1], title: HEADS[1], slot: "tomorrow 09:00", length: "4 sections", gen: { name: "read_guild", icon: "activity", args: "window: 24 h", result: "messages: 640\njoins: 4\nleft: 1" }, voice: { name: "generate_voice", icon: "mic", args: "38 words", result: "9.1 s" }, numbers: 0.04 },
    { video: MESSAGES[2], title: HEADS[2], slot: "Wed 09:00", length: "4 sections", gen: { name: "read_guild", icon: "activity", args: "window: 24 h", result: "messages: 910\njoins: 9\nautomod: 2" }, voice: { name: "generate_voice", icon: "mic", args: "51 words", result: "12.4 s" }, numbers: 0.08 },
  ],
  moreStatus: (slot) => `Drafting the digest for ${slot}`,
  weekIntro: "One digest a day from here, and I read what each one taught: which invitation people arrive on, which rule catches spam rather than chat, and which section gets read.",

  // ---------- the week ----------
  week: WEEK,
  videos: MESSAGES,
  titles: HEADS,
  slots: SLOTS,
  // the week runs faster as it goes: five times at the start, eight by the
  // last day
  speeds: [5, 5, 5.5, 6, 6.5, 7, 8],
  weekStatus: (day, what) => `Day ${day}: ${what}`,
  weekUploadLengths: ["4 sections"],

  // ---------- the numbers ----------
  // every count here is the bot's own work, so all of them start at zero on
  // the day it was installed; the guild's 412 members are the premise, not a
  // number the run grows
  numbers: {
    curve: ACTIVITY,
    final: FINAL,
    // [lead, pow] per tile
    shapes: { views: [0.2, 3.4], watch: [0.2, 4.1], subs: [0.15, 4.4], comments: [0.12, 5], revenue: [0.08, 5.6] },
    // the rail tiles this goal needs, and how often each may be told to roll.
    // The labels come from the project's template (src/kinds.js pipeline),
    // so the ids are the pipeline's own: pages processed is messages read,
    // errors is what the rule caught, success is the share of clean messages,
    // revenue is the month's bill
    tiles: [
      { id: "series", every: 200, read: "users", tell: "users" },
      { id: "pages", every: 260, read: "comments", tell: "stats" },
      { id: "errors", every: 340, read: "watch", tell: "stats" },
      { id: "revenue", every: 430, read: "revenue", tell: "revenue" },
    ],
    // the count passing a round number is worth a line in the log
    crossing: { step: 1000, read: "comments", kind: "run", text: (t) => `${t}k messages read and answered` },
    // the log reads the tiles' own numbers at the close of a day
    dayLine: (day, messages) => `Day ${day}: ${messages} messages handled`,
    gainedLine: (gained) => `${gained} new members welcomed today`,
  },

  // the demo's own clip, opened in the browser window
  generated: GENERATED,
};

export default script;