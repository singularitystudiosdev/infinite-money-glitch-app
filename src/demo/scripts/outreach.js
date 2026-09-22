// demo/scripts/outreach.js: the cold-email goal, as data. "Run cold email
// outreach for my web design agency, 30 emails a day, book calls", played on
// the same player as the climbing goal (demo/run.js), authored against the
// same contract (demo/scripts/contract.js#validateScript).
//
// THE CONTRACT'S WORDS ARE THE VIDEO GOAL'S WORDS. run.js reads a fixed
// vocabulary (videos, titles, slots, upload, weekUploadLengths, numbers.final
// .subs/.comments/.watch) and this goal has no uploads. Where the two differ,
// the field keeps its shape and changes its meaning, and the mapping is said
// here once rather than left to be guessed:
//
//   videos[]          one email the agent sent (url = the mailbox it is in)
//   titles[]          the subject line of that email
//   slots[]           the three send windows of the day: 3 x 10 = 30 a day
//   upload(title,s)   send_batch: ten emails at the window s
//   artifact(v,..)    the sent-email card that opens the mailbox thread
//   weekUploadLengths the batch size, so the card reads "10 sent" not a runtime
//   numbers.curve     14 days of send volume: the warm-up ramp, then a flat 30
//   numbers.final     subs -> calls booked, comments -> replies,
//                     watch -> emails sent, revenue -> revenue
//   week              the first campaign week: the first reply, the first call,
//                     the two experiments and the first signed project
//   voice.milestone   the warm-up landing as a voice note (the contract wants
//                     an audio artifact here; the agent narrates its own
//                     milestone), see assets/demo/outreach/manifest.json
//
// Numbers are the benchmark range for cold outbound, not invented: 3 to 5%
// reply on a warmed domain, 1 to 3% of sends becoming a booked call, and a
// 2.5 to 4% booking rate for a 15-minute intro call. Sending cost is Resend's
// published price: 3,000 emails a month on the free tier, and 30 a day is 900.
import { icon } from "../../icons.js";

export const DEMO_ID = "outreach";
export const ASSETS = "assets/demo/outreach";
// the closing mark and the brand assets, captured once and shared
export const SHARED = "assets/demo";

export const REQUEST = "Run cold email outreach for my web design agency, 30 emails a day, book calls";
export const TITLE = "Cold email that books calls";
// who is sending: the agency, its sending domain and the mailbox the goal runs
export const AGENCY = "Northlight Studio";
export const DOMAIN = "northlight.studio";
export const SENDER = "sara@northlight.studio";
export const ACCOUNT = SENDER;
export const OFFER = "a five-page site that carries the work it already won";

// the plan: the domain, the warm-up, the volume, the follow-up and what it
// costs. The cost line is the goal's own (contract: a plan carries one)
export const PLAN = [
  { title: "Send from northlight.studio, not a Gmail address", detail: "The mailbox and the sending domain are connected, SPF, DKIM and DMARC published, and the domain verified before a single email goes out. Everything goes out from sara@northlight.studio and stays in the reply threads." },
  { title: "Warm the domain up to 30 a day", detail: "10 sent on day one, plus 4 a day to a ceiling of 30, and the volume only rises while deliverability holds and nothing bounces. A cold domain that starts at 30 gets itself filtered." },
  { title: "Thirty a day, written from each lead's own site", detail: "The list is design-led studios whose site loads slow on a phone. Every email names what its own page costs them; no template, no mail-merge, no tracking pixel." },
  { title: "Two follow-ups, then stop", detail: "Day 3 and day 7, once each, and only to the silent half. A reply, a bounce, a no or an unsubscribe stops the sequence for good." },
  { title: "Estimated cost: about $31 a month", detail: "The Google Workspace mailbox is $7.20, and 900 emails a month sits inside Resend's free tier of 3,000. Lead data is about $24. One booked call pays for the year." },
];

export const THINKING = {
  request: ["Reading the brief: an agency, 30 a day, calls booked", "Checking the domain's sending records before a single email leaves", "Counting what 30 a day costs and what one booked call is worth"],
  first: ["Writing the offer: a five-page site that carries the work it already won", "Building the list of studios whose site loads slow on a phone", "Connecting the mailbox and the sending domain", "Publishing SPF, DKIM and DMARC and verifying the domain", "Warming the domain up to 30 a day", "Sending the first 30 and waiting on the first reply"],
};

// the first email, worked in full: every tool call, the note it leaves, and
// the screenshot it took. A shot is what the agent was looking at
export const FIRST_EMAIL = [
  { tool: { name: "verify_mailbox", icon: "shield-check", args: "address: sara@northlight.studio, send: probe to self", result: "signed in: sara@northlight.studio\nprobe delivered in 4 s\nSPF+DKIM aligned: yes" }, shot: { file: "mailbox.png", caption: "Gmail: the mailbox every send comes out of" }, note: "The mailbox is the one the studio already answers in. A prospect replying here gets an answer from a human, not a ticket." },
  { tool: { name: "list_leads", icon: "search", args: "query: design and branding studios, 2 to 12 people\nfilter: site built on Squarespace or Wix, mobile LCP over 3 s, contact form, no case studies page\nregion: US, CA, UK", result: "412 matched\n186 have a contact form and no published work\ncolumns: studio, site, city, load time, stack, contact" }, note: "412 studios carry a slow page and no case studies. That gap is the whole pitch: the work exists, the site does not show it." },
  { tool: { name: "open_site", icon: "compass", args: "lead: welbyandco.com, device: mobile", result: "LCP 4.1 s, 14 images over 900 KB\nno page for the work\ncontact form only\nlast post: March 2024" }, note: "One lead read end to end before writing a word. The number that matters is the 4.1 s: it is in the subject line, and it is why the reply comes." },
  { tool: { name: "write_email", icon: "file-text", args: "lead: welbyandco.com, angle: the 4.1 s page, offer: five pages that carry the work\nlength: 96 words", result: "\"Hi Dana — welbyandco.com takes 4.1 s to load on a phone, so about half of the people who click your Instagram don't see it. We build five-page sites for studios like yours, and the first one is a page for the work you already shipped. Worth 15 minutes Thursday? — Sara\"\nsubject: Your site takes 4.1 s on a phone\nlinks: 1, tracking: none" }, note: "Ninety-six words, one number, one question. The subject is the finding, and the email offers a page for work they already did, not a redesign." },
  { tool: { name: "verify_email", icon: "shield-check", args: "mailbox: dana@welbyandco.com, checks: MX, SMTP, catch-all, disposable", result: "MX: present (Google)\nSMTP 250 OK\ncatch-all: no\nrisk: low\nlist after the check: 397 of 412" }, note: "Fifteen leads dropped on the hard checks. A bounced address costs more than a missing one: two bounces on a new domain and the next 30 land in spam." },
];

// the DNS step: the sending domain, the three records, the DMARC policy that
// rides with them, and the verification that has to pass before any volume.
// G9's first requirement, and the beat the goal is judged on
export const DNS = [
  { tool: { name: "create_domain", icon: "plus", args: "name: northlight.studio, region: us-east-1", result: "status: not_started\nrecords to publish: 3\n- MX  send.northlight.studio  ->  feedback-smtp.us-east-1.amazonses.com (10)\n- TXT send.northlight.studio  ->  \"v=spf1 include:amazonses.com ~all\"\n- CNAME resend._domainkey.northlight.studio -> resend._domainkey.resend.com" } },
  { tool: { name: "create_dns_record", icon: "command", args: "zone: northlight.studio, records: 3 (MX, TXT, CNAME), ttl: 3600, proxy: off", result: "created: 3\nMX send\nTXT send\nCNAME resend._domainkey\npropagation: 4 min" }, shot: { file: "dns-panel.png", caption: "The DNS panel: SPF, DKIM and DMARC on northlight.studio" } },
  { tool: { name: "create_dns_record", icon: "shield-check", args: "zone: northlight.studio, type: TXT, name: _dmarc, value: \"v=DMARC1; p=none; rua=mailto:dmarc@northlight.studio\", ttl: 3600", result: "created: 1\npolicy: p=none\nreports: aggregate, daily" } },
  { tool: { name: "verify_domain", icon: "check", args: "domain: northlight.studio, checks: spf, dkim, dmarc, return-path", result: "SPF: pass (amazonses, ~all)\nDKIM: pass (resend._domainkey, 2048-bit)\nDMARC: pass (p=none, rua set)\nstatus: verified\nsending: enabled" } },
];
export const DNS_NOTE = "Four minutes to propagate and all three pass. p=none first, so the daily reports arrive before anything is quarantined; the policy tightens to quarantine once two weeks are clean.";

// the warm-up: the volume ramp the goal is judged on (G9). The tool starts
// it, the screenshot is the curve, the milestone is the agent's own voice
// note that the ramp is running
export const WARMUP = {
  tool: { name: "start_warmup", icon: "activity", args: "domain: northlight.studio, from: 10/day, ramp: +4/day, ceiling: 30/day, pause under: 98% delivered", result: "day 1: 10 sent, 0 bounced, 0.0% complaints\nramp: 10, 14, 20, 24, 26, 28, 30\nwarm-up: 7 days to ceiling" },
  shot: { file: "warmup.png", caption: "The warm-up curve: 10 a day to 30, one step a day" },
  milestone: { title: "Warm-up started", text: "10 a day, +4 a day, ceiling 30 · to the ceiling on day 7", src: "warmup.m4a", icon: "activity", media: "audio", mediaTitle: "Warm-up note" },
};

export const LAUNCH = { name: "launch_campaign", icon: "zap", args: "leads: 397, volume: 30/day, slots: 09:00, 12:30, 16:00, follow-ups: day 3, day 7", result: "queued: 30\nfirst batch: 10 at 09:00\nstop on: reply, bounce, unsubscribe" };
export const SEND_BATCH = (title, slot = "09:00") => ({ name: "send_batch", icon: "mail", args: `to: 10 leads, subject: "${title}", window: ${slot}`, result: `sent: 10 at ${slot}\nfrom: sara@northlight.studio\ntracking: off, links: 1` });

// the three send windows the 30 a day go out in: ten in each
export const SLOTS = ["09:00", "12:30", "16:00"];

// the first campaign week: the first reply, the first call, two experiments
// and the first signed project. Each day is the tool calls the agent ran and
// the one thing the day taught
export const WEEK = [
  { day: 1, tools: [{ name: "read_delivery", icon: "activity", args: "domain: northlight.studio, window: 24h", result: "sent: 30\ndelivered: 30\nbounced: 0\nspam complaints: 0" }, { name: "read_warmup", icon: "shield-check", args: "domain: northlight.studio", result: "volume: 30/day\nwarm-up: complete, day 7\nreputation: 97/100" }], note: "Thirty delivered, nothing bounced, no complaint. Volume holds at 30 until the reply rate moves." },
  { day: 2, tools: [{ name: "read_inbox", icon: "inbox", args: "query: is:unread, newer: 24h", result: "1 reply\n\"What would a rebuild run us?\"\n- Dana Whitfield, welbyandco.com, 14:06" }, { name: "reply_email", icon: "mail", args: "to: dana@welbyandco.com, offer: $4,800 for five pages, link: the 15-minute slot", result: "sent 14:31\nsame thread, same subject" }], note: "The first reply lands 31 hours in, on the lead whose page takes 4.1 s. The answer is a price and a time, in one paragraph." },
  { day: 3, tools: [{ name: "read_calendar", icon: "calendar-clock", args: "source: booking link, range: this week", result: "Thu 14:00 · Dana Whitfield, welbyandco.com\ncalls booked: 1\nshow-up rate so far: n/a" }, { name: "read_inbox", icon: "inbox", args: "window: 24h, unread: true", result: "3 replies\n2 questions, 1 not now\n0 unsubscribes" }], note: "The first call sits on the calendar five minutes after the price went out. Six words in the reply did it: worth 15 minutes Thursday." },
  { day: 4, tools: [{ name: "read_experiment", icon: "compass", args: "test: subject-1, min_confidence: 0.9, metric: reply_rate", result: "A \"Quick question about welbyandco.com\": 1.9% (312 sent)\nB \"Your site takes 4.1 s on a phone\": 4.6% (308 sent)\nconfidence: 0.96" }, { name: "set_sequence", icon: "sliders-vertical", args: "subject: B, every batch, from tomorrow", result: "applied to 3 windows/day" }], note: "The subject that names the lead's own number beats the polite one by more than twice, at 96%. Every batch writes its subject that way now." },
  { day: 5, tools: [{ name: "read_inbox", icon: "inbox", args: "last: 60, class: reply", result: "interested: 9\nquestions: 7\nnot now: 6\nunsubscribe: 1" }, { name: "write_followup", icon: "file-text", args: "to: the silent half, day: 3, one line, one link", result: "queued: 76\nsends: once, then stop" }], note: "Nine in sixty want the call and seven ask a question first. The follow-up goes only to the ones who said nothing, once, and the one unsubscribe is out for good." },
  { day: 6, tools: [{ name: "read_send_time", icon: "clock", args: "by: window, 5 days, metric: reply_rate", result: "09:00: 4.8%\n12:30: 2.1%\n16:00: 1.4%\nreplies per 100 sends: 8.3" }, { name: "set_schedule", icon: "calendar-clock", args: "windows: 08:00 and 11:30, volume: 30/day", result: "from Monday, 15 and 15" }], note: "The morning window replies three times the afternoon one. Thirty a day move to two morning batches; the 16:00 slot is retired." },
  { day: 7, tools: [{ name: "read_pipeline", icon: "receipt", args: "source: cold email, range: week 1", result: "replies: 13\ncalls booked: 5\nquotes out: 3\nsigned: 1 · $4,800\nreply rate: 3.7%" }, { name: "write_report", icon: "file-text", args: "week: 1, to: sara@northlight.studio", result: "drafted, 6 lines\nheld for Monday 09:00" }], note: "Five calls on the calendar and one project signed at $4,800. The report says which subject line and which window did it." },
];

// the subject lines, in the shape the first reply taught: the lead's own
// number in the subject, one question in the body, no template
export const WEEK_TITLES = ["Your site takes 4.1 s on a phone", "The work page your site is missing", "welbyandco.com on 4G: 6.2 s", "A page for the work you already shipped", "Your contact form has one field too many", "Loaded in 1.1 s: what your portfolio page could do", "Your Instagram link lands on a 5.8 s load", "Five pages, the work first", "The case study page nobody can find on your site", "welbyandco.com doesn't say what you charge", "Your homepage hides the three best projects", "4.1 s on a phone, 0.9 s on your competitor's", "The rebuild your last three clients asked about", "Your site works on desktop, not on a phone", "A page for the bakery AI you filed under news", "One page per project, live by Friday", "Your site's biggest image is 2.4 MB", "The map on your contact page takes 3 s", "Your last post was March 2024", "Six studios like yours, six new sites", "Your work page returns a 404 on mobile", "The brief form that gets you three calls a week", "Your site loads slow on the phone your clients use", "Five pages that carry the work you already won"];


// the sent emails the batch cards link to (the mailbox they are read in).
// One per subject, so the week's 21 sends and the two after the first never
// repeat a card
const SENT_IDS = ["em-8401", "em-8402", "em-8403", "em-8404", "em-8405", "em-8406", "em-8407", "em-8408", "em-8409", "em-8410", "em-8411", "em-8412", "em-8413", "em-8414", "em-8415", "em-8416", "em-8417", "em-8418", "em-8419", "em-8420", "em-8421", "em-8422", "em-8423", "em-8424"];
export const SENT = SENT_IDS.map((id) => ({ id, url: "https://mail.google.com/mail/u/0/#sent" }));

// the first send as the user watches it: a screen capture of the send window
// and the batch it goes out in (assets/demo/outreach/, see its manifest.json).
// The browser window shows about six seconds of it
export const GENERATED = { file: "first-send.webm", seconds: 6 };

// the opening line, on the brand green before anything else is drawn
export const QUOTE = { text: "“Half my advertising spend is wasted; the trouble is I don't know which half.”", by: "- John Wanamaker" };
// the sign-off: the mark, then the name
export const OUTRO = { logo: "dawn-mark.png", name: "DAWN" };

// where the numbers end up: 14 days of send volume — the warm-up ramp, then
// the steady 30 a day the goal was asked for
export const SEND_CURVE = [10, 14, 20, 24, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30];
// subs -> calls booked, comments -> replies, watch -> emails sent, revenue ->
// what the calls turned into
export const FINAL = { subs: 5, comments: 13, watch: 352, revenue: 4800 };

// ---------- the script run.js plays ----------

const script = {
  id: DEMO_ID,
  title: TITLE,
  request: REQUEST,
  template: "outreach",
  assets: ASSETS,
  shared: SHARED,
  quote: QUOTE,
  outro: OUTRO,
  plan: PLAN,
  thinking: THINKING,
  // the line above the plan card
  planSay: (title) => `Here is the plan for ${title}. It sends from your own domain once SPF, DKIM and DMARC pass, warms to 30 a day, and writes each email from the lead's own site. Change anything, or approve it and I start.`,

  // ---------- the account the goal needs ----------
  connect: {
    probe: "gmail",
    platform: "Gmail",
    mark: "mail",
    auth: "oauth2",
    title: "Connect Gmail",
    url: "/api/connect/gmail/start",
    say: "That is the plan. One thing from you: sign in to the studio mailbox once, so the sends leave from sara@northlight.studio and every reply comes back into the thread it started. I keep the token, never the password.",
    statusOpening: "Opening the mailbox",
    statusWaiting: "Waiting on Google sign-in",
    log: (account) => `Mailbox connected as ${account}`,
  },
  account: ACCOUNT,

  // ---------- the setup the goal needs, and the rail it lands on ----------
  setup: {
    status: "Setting up the sending",
    line: (c) => `Mailbox connected: **${c.sender}**. The sending domain **${c.domain}** and its three DNS records are next; the log and the numbers are on the right. Batches go out at ${c.slots.join(", ")}.`,
    log: (c) => `Sending domain added: ${c.domain}`,
    done: ["gmail", "resend", "card"],
    summary: { gmail: `Mailbox ${SENDER}`, resend: `Sending domain ${DOMAIN}, verified`, card: "Visa ending 4242" },
    account: ACCOUNT,
    sender: SENDER,
    domain: DOMAIN,
    agency: AGENCY,
    slots: SLOTS,
    missions: [
      { id: "demo-domain", title: "Get northlight.studio sending clean", site: "Resend", url: "https://resend.com/domains", icon: "shield-check", progress: 24, steps: ["Publishing the MX, SPF and DKIM records", "Adding the DMARC policy at p=none", "Verifying the domain before any volume", "Watching the first day's bounces"] },
      { id: "demo-warmup", title: "Warm the domain to 30 a day", site: "Resend", url: "https://resend.com/domains", icon: "activity", progress: 12, steps: ["Sending 10 on day one", "Adding 4 a day to the ceiling", "Holding deliverability above 98%", "Reaching 30 a day on day 7"] },
      { id: "demo-first-calls", title: "Book the first five calls", site: "Gmail", url: "https://mail.google.com", icon: "calendar-clock", progress: 0, steps: ["Writing the list of 397 studios", "Answering every reply the same day", "Sending the price in the first reply", "Keeping Thursday's call on the calendar"] },
    ],
    tool: { name: "connect_sending", icon: "mail", args: `mailbox: ${SENDER}, sending domain: ${DOMAIN}, volume: 30/day`, result: `gmail: connected\nsending domain: not_started\nwarm-up: not started\nlist: 397 of 412 leads checked` },
    // how far the rail's missions move at each beat of the story
    steps: { first: 20, upload: 26, more: 16, week: 30 },
  },

  // ---------- the first email, worked in full ----------
  work: FIRST_EMAIL,
  workStatus: THINKING.first,
  workLog: "Checked the mailbox, built the 412-studio list and wrote the first email",
  workSay: "The list is 412 studios whose site loads slow on a phone and never shows the work. The first email is 96 words, subject line is the lead's own number, and it offers a page for work they already shipped.",
  // the DNS step, in the slot the video goal uses for its generation screens
  media: DNS,
  mediaNote: DNS_NOTE,
  mediaInsight: { kind: "insight", text: "DMARC p=none first, quarantine once two weeks of reports stay clean", delta: 12 },
  voice: WARMUP,
  voiceLog: "Warm-up started, 10 a day to a ceiling of 30",
  render: LAUNCH,
  // the batch card and the sent email it becomes
  upload: SEND_BATCH,
  artifact: (v, title, slot, length) => ({ url: v.url, title: `Sent: ${title}`, mark: icon("mail"), meta: `${slot} · ${length} · sara@northlight.studio` }),
  liveSay: (title, url, slot) => `The first batch is out: 10 sent at ${slot}, subject "${title}". The other twenty go today and every day, and a reply stops the sequence for that lead.`,
  status: { cutting: "Writing the 12:30 batch", readingWeek: "Reading the week's replies", waiting: "Waiting on the plan" },

  // ---------- the next batches, before the week ----------
  more: [
    { video: SENT[1], title: WEEK_TITLES[1], slot: SLOTS[1], length: "10 sent", gen: { name: "write_batch", icon: "file-text", args: "leads: 10, source: each lead's own site, reuse: 0 sentences", result: "10 drafts, 10 different openers" }, voice: { name: "check_batch", icon: "shield-check", args: "spam score, links: 1, tracking: off", result: "spam 0.4, 1 link, no pixel" }, numbers: 0.04 },
    { video: SENT[2], title: WEEK_TITLES[2], slot: SLOTS[2], length: "10 sent", gen: { name: "write_batch", icon: "file-text", args: "leads: 10, source: each lead's own site, reuse: 0 sentences", result: "10 drafts, 3 dropped on the hard checks" }, voice: { name: "check_batch", icon: "shield-check", args: "spam score, links: 1, tracking: off", result: "spam 0.5, 1 link, no pixel" }, numbers: 0.08 },
  ],
  moreStatus: (slot) => `Writing the ${slot} batch`,
  weekIntro: "Thirty a day from here. From now on it is what lands: the first reply, the price that books the call, the subject line test and the window the replies come in.",

  // ---------- the week ----------
  week: WEEK,
  videos: SENT,
  titles: WEEK_TITLES,
  slots: SLOTS,
  // the week runs faster as it goes: four times at the start, seven by the
  // last day
  speeds: [4, 4, 5, 5, 6, 6.5, 7],
  weekStatus: (day, what) => `Day ${day}: ${what}`,
  weekUploadLengths: ["10 sent", "10 sent", "10 sent"],

  // ---------- the numbers ----------
  numbers: {
    curve: SEND_CURVE,
    final: FINAL,
    // [lead, pow] per tile. Revenue turns last: the calls book before the
    // project signs, so the money lands at the end of the week, not the middle
    shapes: { views: [0.3, 2.8], watch: [0.34, 2.4], comments: [0.22, 4.2], subs: [0.16, 4.6], revenue: [0.05, 6.2] },
    // the rail tiles this goal needs, and how often each may be told to roll.
    // The ids are the outreach kind's own (src/kinds.js: outreach tiles) and
    // the read is the stat run.js keeps for it: contacts -> the send curve,
    // replies -> comments, meetings -> subs, revenue -> revenue
    tiles: [
      { id: "contacts", every: 200, read: "users", tell: "users" },
      { id: "replies", every: 260, read: "comments", tell: "stats" },
      { id: "meetings", every: 320, read: "subs", tell: "stats" },
      { id: "revenue", every: 430, read: "revenue", tell: "revenue" },
    ],
    // the count passing a round number is worth a line in the log. A step of
    // 100 reads back as hundreds of sends (0.1k on the way to 0.4k)
    crossing: { step: 100, read: "watch", kind: "lead", text: (k) => `${Math.round(k * 1000)} emails sent` },
    // the log reads the count's own numbers at the close of a day
    dayLine: (day, sent) => `Day ${day}: ${sent} emails out today`,
    gainedLine: (gained) => `${gained} calls booked`,
  },

  // the demo's own clip, opened in the browser window
  generated: GENERATED,
};

export default script;