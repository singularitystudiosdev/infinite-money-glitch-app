// demo/scripts/bakery.js: the bakery goal, as data. The goal is the P15/P16
// corpus row "Make me a website for my bakery, Flour & Salt, with the menu,
// hours, a map and online ordering": the shop's own domain and host
// connected, the site built and deployed, an audit before it takes money,
// and the first order read back out of the shop's own Stripe account.
//
// Every screenshot named here is a real capture of a real service, listed in
// assets/demo/flour-and-salt/manifest.json with its source url; the capture
// item that owns assets/demo/flour-and-salt/** produces the files, and the
// player skips a shot that is not on disk yet (run.js#shot). The words are
// the agent's, in the same register as climbing.js: short, first person, one
// observation per note, tool results as terse multi-line facts.
//
// run.js plays it and knows nothing about bakeries. Nothing in run.js names
// this goal.
import { STRIPE_MARK } from "../../icons.js";

export const DEMO_ID = "flour-and-salt";
export const ASSETS = "assets/demo/flour-and-salt";
// the shared media folder: the product's own sign-off mark lives there
export const SHARED = "assets/demo";

export const REQUEST = "Make me a website for my bakery, Flour & Salt, with the menu, hours, a map and online ordering";
export const TITLE = "Flour & Salt";
export const DOMAIN = "flourandsalt.com";
export const ACCOUNT = "hello@flourandsalt.com";

// the plan: the shop's own domain, the pages a bakery actually needs, the
// checkout on the shop's own Stripe account, and what the launch costs.
// Costs are from the platform's own price table (server/pricing.json, checked
// 2026-09-19): image_generation $0.04, video_second $0.40, voice_1k_chars
// $0.30, plus model time. Nothing here is a price the platform does not know.
export const PLAN = [
  { title: "Put the shop on its own domain", detail: `${DOMAIN}, bought and pointed at the host with DNS records the platform writes; the shop's spelling, not a hyphenated one.` },
  { title: "Build the pages a bakery needs", detail: "The menu with today's bake and prices, the hours, the address and map, an allergen sheet, and an order page — every page under 100 KB and readable at phone width." },
  { title: "Wire online ordering to your Stripe", detail: "A basket, a pickup time inside the shop's real hours, and card checkout that settles into your own account; the confirmation email tells the customer their slot." },
  { title: "Estimated cost: about $13.10 for the launch", detail: "$12.00 for the 30-second home clip at $0.40 a second, $0.84 for 21 product photos at $0.04 each, $0.07 for the confirmation note, and about $0.20 of model time." },
  { title: "Report every Monday", detail: "Orders, revenue, average basket, the bake that sold out and the one that did not, and the one change for next week." },
];

export const THINKING = {
  request: ["Reading the brief: a menu, hours, a map and ordering, on the shop's own name", "Checking what a bakery site has to do that a shop page does not: pickup windows, allergens, and today's bake", "Costing the launch: the home clip, the product photos and the voice note"],
  // the strip's line per beat: the first three are the work's own steps, the
  // last three name the beats after it (run.js reads workStatus[3] before
  // the media block, [4] before the voice and [5] before the render)
  first: ["Searching for the domain in the shop's own spelling", "Registering the domain and pointing it at the host", "Building the menu, the hours, the visit and order pages", "Loading the live pages the way a customer will, and auditing them", "Recording the note that plays after checkout", "Publishing the first bake and reading the first order that lands"],
};

// the first artifact, worked in full: the domain, the deploy and the order
// page, one tool call at a time. A shot is what the agent was looking at.
export const WORK = [
  {
    tool: { name: "search_domain", icon: "search", args: `name: "${DOMAIN}", tld: .com`, result: `flourandsalt.com — available, $11.20/year\nflour-and-salt.com — taken (parked)\nflourandsalt.co.uk — taken` },
    shot: { file: "domain-search.png", caption: "Domain search: flourandsalt.com is available" },
    note: "The hyphenated version went years ago. The shop's own spelling is free, so that is the one.",
  },
  {
    tool: { name: "buy_domain", icon: "credit-card", args: "registrar: Cloudflare, term: 1 year, auto-renew: on", result: "registered\nnameservers: pam.ns.cloudflare.com, bob.ns.cloudflare.com\naccount: hello@flourandsalt.com" },
    note: "Registered on the shop's own account, auto-renew on. Nobody has to touch this again.",
  },
  {
    tool: { name: "set_dns", icon: "settings", args: `A @ → 76.76.21.21\nCNAME www → cname.pages.cloudflare.com\nTXT _stripe-verify → stripe-domain-check`, result: "3 records written\npropagated in 4 min\nwww → apex redirect: on" },
    shot: { file: "dns-panel.png", caption: "DNS records for flourandsalt.com" },
    note: "Three records: the host, the www redirect, and Stripe's own verification line, which is what lets checkout run on the domain rather than a subdomain.",
  },
  {
    tool: { name: "build_site", icon: "monitor", args: "pages: menu, hours, visit, allergens, order\ntheme: warm, 44 px base, phone first", result: "6 pages built\n41 photos at 41 KB average\nno page over 96 KB" },
    note: "Six pages, and the menu is the one that has to change every day, so it is built from a data file the shop keeps, not written by hand.",
  },
  {
    tool: { name: "deploy", icon: "zap", args: "project: flour-and-salt, branch: main, target: production", result: "published in 42 s\nflourandsalt.com 200, HTTPS on\nwww → apex 301\nmap + order page reachable" },
    shot: { file: "host-panel.png", caption: "Hosting dashboard: the first production deploy" },
    note: "Live on the shop's own domain, HTTPS on, www redirecting where it should. The map and the order page answered 200 on the first try.",
  },
];

// the launch beat: the page loaded three ways, the audit, and the first
// order read back. run.js draws one card and one shot per item here, then
// the single note below
export const LAUNCH = [
  { tool: { name: "open_page", icon: "eye", args: "url: flourandsalt.com, device: phone", result: "home 200 in 0.6 s\nmenu, hours, map and order all reachable\nno layout shift" }, shot: { file: "site-live.png", caption: "The deployed bakery site, home page" } },
  { tool: { name: "open_page", icon: "file-text", args: "url: flourandsalt.com/menu, what: today's bake", result: "3 items with prices and allergens\nbread from $4.80, pastries from $3.50\nsold-out mark shown per slot" }, shot: { file: "menu-page.png", caption: "The live menu page: today's bake and prices" } },
  { tool: { name: "open_page", icon: "credit-card", args: "url: flourandsalt.com/order, basket: 1 sourdough + 2 croissants", result: "pickup 08:15 · $11.80\ncard form: Stripe, on the shop's own domain" }, shot: { file: "order-checkout.png", caption: "Checkout: basket, pickup time and card" } },
  { tool: { name: "run_lighthouse", icon: "activity", args: "url: flourandsalt.com, form factor: mobile", result: "performance 98\naccessibility 100\nbest practices 100\nSEO 100\nLCP 1.1 s, total 96 KB" }, shot: { file: "lighthouse.png", caption: "Lighthouse report for the deployed site" } },
  { tool: { name: "read_orders", icon: "receipt", args: "since: deploy, source: stripe", result: "3 orders\n#1001 · 2 country sourdough, 6 butter croissants · $30.60 · paid, pickup 08:15\n#1002 · 1 seeded rye · $6.20 · pickup 08:00\n#1003 · 4 croissants, 1 sourdough · $18.80 · pickup 07:45" }, shot: { file: "order-admin.png", caption: "The first order, and the two that followed, in the shop's Stripe dashboard" } },
];
export const LAUNCH_NOTE = "The site held 98 on a phone and every other score 100. The first order came thirteen minutes after the deploy: two loaves and six croissants for 08:15.";
export const LAUNCH_INSIGHT = { kind: "insight", text: "Every order in the first hour chose the 07:45 to 08:15 pickup; the noon slot has taken nothing", delta: 24 };

export const VOICE = {
  tool: { name: "generate_voice", icon: "mic", args: 'voice: "Marguerite", 38 words', result: "15.4 s\npeak -1.2 dB, no clipping" },
  shot: { file: "elevenlabs.png", caption: "ElevenLabs: recording the note that plays after checkout" },
  milestone: { title: "Order note recorded", text: "15 s · plays on the confirmation page · from the 38-word copy", src: "voice.m4a", icon: "mic", media: "audio", mediaTitle: "Order confirmation note" },
};

// the last build before the shop opens: the production bundle the host
// serves, then the bake that goes live on it
export const RENDER = { name: "run_build", icon: "settings", args: "6 pages, 41 photos, map + checkout", result: "built in 38 s\n96 KB average page\nsitemap.xml and robots.txt written" };
export const UPLOAD = (title, slot = "06:30") => ({ name: "publish_bake", icon: "compass", args: `bake: "${title}", slot: ${slot}, orders: open until sold out`, result: `live at ${DOMAIN}/menu\norders open for the ${slot} slot\ncheckout: Stripe` });

// the three times a day the shop's bake goes up on the menu. A bakery's day
// is three bakes: the morning bread, the noon tray, the evening batch.
export const SLOTS = ["06:30", "12:00", "18:00"];

// the week: the tests a shop runs on its own site. Each day is a few tool
// calls and the note the day taught, then its three bakes
export const WEEK = [
  { day: 2, tools: [{ name: "read_traffic", icon: "compass", args: "source: all, days: 7", result: "google business profile: 61%\ninstagram: 24%\ndirect: 15%" }, { name: "read_orders", icon: "activity", args: "by: hour, days: 3", result: "06:30–09:00: 58% of orders\n12:00: 21%\n18:00: 21%" }], note: "Three in five orders are picked up before nine, and most of the traffic comes from the map listing the shop already had. The morning bake is the one that matters." },
  { day: 3, tools: [{ name: "read_menu", icon: "file-text", args: "metric: sell-through, days: 7", result: "country sourdough: 100% (sold out by 09:40 twice)\nseeded rye: 96%\nwhite tin: 41%\nchocolate chip cookie: 18%" }, { name: "set_menu", icon: "pencil", args: "cut: white tin, chocolate chip cookie\npromote: country sourdough to the top", result: "menu updated for tomorrow" }], note: "The white tin and the cookie were the quiet two; the sourdough sold out twice by half past nine. Two lines off, the sourdough to the top." },
  { day: 4, tools: [{ name: "read_experiment", icon: "compass", args: "test: hero-2, min_confidence: 0.9", result: "A (the shopfront): 2.8% start a basket\nB (the cut loaf and the crumb): 6.7%\nconfidence: 0.96" }, { name: "set_hero", icon: "image", args: "variant: B, alt: \"a sourdough loaf cut open, the crumb\"", result: "applied to the home page" }], note: "The cut loaf beat the shopfront by more than twice. The crumb is the first thing on the page from now on." },
  { day: 5, tools: [{ name: "read_checkout", icon: "activity", args: "step: pickup time, days: 7", result: "basket: 100%\npickup time: 62%\npayment: 88%\nof the ones who leave: 71% had picked a slot outside the shop's hours" }, { name: "set_hours", icon: "calendar-clock", args: "pickup slots: 07:00–15:00, 15-minute steps, 32 a day", result: "applied to the order page and the confirmation email" }], note: "Two baskets in five stopped at the pickup step, and the ones who left had chosen hours the shop is shut. The picker only offers the hours the shop is open now." },
  { day: 6, tools: [{ name: "read_orders", icon: "receipt", args: "metric: average basket, days: 7", result: "$18.40 (bread alone $11.20)\n41% of baskets take a loaf and a pastry" }, { name: "set_bundle", icon: "coins", args: "bundle: any loaf + four croissants, $16.50", result: "live on the order page\nwas $18.80 bought apart" }], note: "Baskets with a loaf and a pastry run 64% more than bread alone. That loaf and four croissants are one line now, $16.50 against $18.80 bought separately." },
  { day: 7, tools: [{ name: "read_reviews", icon: "mail", args: "since: launch, source: google", result: "23 reviews, 4.8 average\n4 mention the sourdough selling out\n3 ask for a Saturday-only item" }, { name: "set_bake", icon: "clock", args: "sourdough: 24 → 36 loaves on weekdays\nSaturday: + chocolate babka", result: "applied to tomorrow's bake" }], note: "Four reviews name the sourdough selling out, so tomorrow's bake is up a third. Saturday gets the babka three people asked for." },
];

// the bakes that go up on the menu: the day's list in the order the shop
// bakes them, in the register the menu itself uses
export const WEEK_TITLES = ["Country sourdough, 24-hour ferment", "Seeded rye with caraway", "Butter croissants, plain", "Pain au chocolat", "Rosemary focaccia", "Wholemeal spelt loaf", "Cinnamon morning buns", "Cardamom knots", "Walnut and fig bâtard", "Pumpernickel, sliced", "Olive and thyme sourdough", "Cheese and black pepper loaf", "Pistachio and raspberry danish", "Iced lemon buns", "Honey and oat tin loaf", "Soft white sandwich loaf", "Kimchi and spring onion focaccia", "Chocolate babka, Saturday only", "Rye and treacle loaf", "Cherry and almond galette", "Three-cheese and chive scones"];

// the shop's own menu pages: each bake has a page the order card links to and
// a photograph under thumbs/ (the platform's own generated product shots, the
// way the climbing demo's 21 thumbnails are: fal.ai, nano-banana-2, prompts
// in thumbs-prompts.txt)
const MENU_SLUGS = ["country-sourdough", "seeded-rye", "butter-croissants", "pain-au-chocolat", "rosemary-focaccia", "wholemeal-spelt", "cinnamon-morning-buns", "cardamom-knots", "walnut-fig-batard", "pumpernickel", "olive-thyme-sourdough", "cheese-pepper-loaf", "pistachio-raspberry-danish", "iced-lemon-buns", "honey-oat-tin", "soft-white-tin", "kimchi-focaccia", "chocolate-babka", "rye-treacle-loaf", "cherry-almond-galette", "three-cheese-chive-scones"];
export const MENU = MENU_SLUGS.map((slug) => ({ id: slug, url: `https://${DOMAIN}/menu/${slug}`, thumb: `thumbs/${slug}.jpg` }));

// the first thing the browser window shows: an 8-second walk down the live
// order page, filmed from the deployed site
export const GENERATED = { file: "site-walkthrough.mp4", seconds: 8 };

// the opening line, on the brand green before anything else is drawn
export const QUOTE = { text: "“Good bread is the most fundamentally satisfying of all foods.”", by: "- James Beard" };
// the sign-off: the mark, then the name
export const OUTRO = { logo: "dawn-mark.png", name: "DAWN" };

// where the numbers end up: the 14-day visitors curve the graph climbs to,
// and the tiles at the close. The site goes up in the middle of the curve,
// so the first eight days are flat. Week one of the site: 306 orders at a
// $18.40 basket, 5.4% of visitors starting a basket, 128 of the customers
// came back, 2,140 items went out of the door.
export const VISITORS_CURVE = [0, 0, 0, 0, 0, 0, 0, 0, 110, 240, 470, 760, 1250, 2840];
export const FINAL = { subs: 306, comments: 128, watch: 2140, revenue: 5640 };

// ---------- the script run.js plays ----------

// the play(): every beat of the run, as data.

// numbers.shapes: [lead, pow] per tile. The orders ramp late and steeply (the
// site only opens in the middle of the curve), the revenue with them, the
// visitors curve slower. watch and comments are channel-shaped keys the
// contract requires and no store tile reads; they are given the bake's own
// ramp so a future store rail reading them shows the same week.
const script = {
  id: DEMO_ID,
  title: TITLE,
  request: REQUEST,
  template: "store",
  assets: ASSETS,
  shared: SHARED,
  quote: QUOTE,
  outro: OUTRO,
  plan: PLAN,
  thinking: THINKING,
  // the line above the plan card
  planSay: (title) => `Here is the plan for ${title}. It buys the shop's own domain, builds the menu, hours and map, and wires ordering to your Stripe. Change anything, or approve it and I start.`,

  // ---------- the account the goal needs ----------
  // The one step that needs the user's own sign-in is the money: ordering
  // settles into the shop's Stripe account, and only the shop can sign in to
  // it. The domain and the host are the agent's to run, so they are setup
  // steps and tool cards, not a popup. Stripe is the connector behind
  // online ordering, and its mark is the brand mark the platform ships.
  connect: {
    probe: "stripe",
    platform: "Stripe",
    mark: "stripe",
    auth: "oauth2",
    title: "Connect Stripe",
    url: "/api/connect/stripe/start",
    say: "Good, that is the plan. One thing from you: sign in to Stripe once and every order settles into your own account. I keep the token, never the password, and the domain and the host are mine to run.",
    statusOpening: "Opening the checkout",
    statusWaiting: "Waiting on Stripe sign-in",
    log: (account) => `Stripe connected as ${account}`,
  },
  account: ACCOUNT,

  // ---------- the setup the goal needs, and the rail it lands on ----------
  setup: {
    status: "Building the site",
    line: (c) => `Site up: **${c.domain}**, ordering on Stripe under ${c.account}. The orders and the log are on the right. The bake goes live at ${c.slots.join(", ")}; starting on the first one.`,
    log: (c) => `Site published: ${c.domain} (order page live, checkout on Stripe)`,
    done: ["domain", "host", "stripe"],
    summary: { domain: `${DOMAIN}, DNS on Cloudflare`, host: "Cloudflare Pages, first deploy live", stripe: "Stripe, connected" },
    account: ACCOUNT,
    domain: DOMAIN,
    slots: SLOTS,
    missions: [
      { id: "demo-site", title: "The site: menu, hours and map", site: "Cloudflare Pages", url: "https://dash.cloudflare.com", icon: "monitor", progress: 26, steps: ["Taking the menu, the hours and the shop's address from the shop's own notes", "Building the menu page from the day's bake", "Dropping the map on the visit page", "Checking every photo at phone width"] },
      { id: "demo-orders", title: "Online ordering through Stripe", site: "Stripe", url: "https://dashboard.stripe.com", icon: "credit-card", progress: 12, steps: ["Sizing the basket to a Saturday morning", "Wiring checkout to the shop's own Stripe account", "Writing the confirmation email", "Watching the first order land"] },
      { id: "demo-bake", title: "Today's bake on the order page", site: "Cloudflare Pages", url: "https://dash.cloudflare.com", icon: "calendar-clock", progress: 0, steps: ["Reading yesterday's sell-through by item", "Setting the morning, noon and evening lists", "Photographing the new focaccia", "Publishing tomorrow's three slots"] },
    ],
    tool: { name: "create_site", icon: "monitor", args: `name: "Flour & Salt", domain: ${DOMAIN}, pages: 6`, result: "created\n6 pages scaffolded\ncheckout: Stripe, waiting on sign-in" },
    // how far the rail's missions move at each beat of the story
    steps: { first: 24, upload: 30, more: 18, week: 26 },
  },

  // ---------- the first artifact, worked in full ----------
  work: WORK,
  workStatus: THINKING.first,
  workLog: `Built the site and pointed ${DOMAIN} at it`,
  workSay: `The site is live at ${DOMAIN} with the menu, the hours and the map, and checkout runs on your Stripe. Loading every page the way a customer will before it takes an order.`,
  media: LAUNCH,
  mediaNote: LAUNCH_NOTE,
  mediaInsight: LAUNCH_INSIGHT,
  voice: VOICE,
  voiceLog: "Order note recorded, 15 s",
  render: RENDER,
  // the bake that goes live, and the card that links to its page
  upload: UPLOAD,
  artifact: (v, title, slot, length) => ({ url: v.url, thumb: `${ASSETS}/${v.thumb}`, title: `Live: ${title}`, mark: STRIPE_MARK, meta: `${DOMAIN} · ${slot} · ${length}` }),
  liveSay: (title, url, slot) => `It is live: [${title}](${url}), on the ${slot} bake. Orders are open until it sells out; the 12:00 and 18:00 bakes are already on the page.`,
  status: { cutting: "Publishing tomorrow's bake", readingWeek: "Reading the week's numbers", waiting: "Waiting on the plan" },

  // ---------- the next artifacts, before the week ----------
  more: [
    { video: MENU[4], title: WEEK_TITLES[4], slot: SLOTS[1], length: "24 focaccia", gen: { name: "generate_image", icon: "image", args: "model: nano-banana-2, scene: the noon focaccia tray, 3 variants", result: "3 variants, 1600×1200" }, voice: { name: "set_batch", icon: "inbox", args: "item: rosemary focaccia, bake: 12:00, count: 24", result: "live for the 12:00 slot" }, numbers: 0.05 },
    { video: MENU[5], title: WEEK_TITLES[5], slot: SLOTS[2], length: "18 loaves", gen: { name: "generate_image", icon: "image", args: "model: nano-banana-2, scene: the evening spelt loaves cooling, 3 variants", result: "3 variants, 1600×1200" }, voice: { name: "set_batch", icon: "inbox", args: "item: wholemeal spelt, bake: 18:00, count: 18", result: "live for the 18:00 slot" }, numbers: 0.09 },
  ],
  moreStatus: (slot) => `Publishing the ${slot} bake`,
  weekIntro: "Three bakes on the order page every day. From here I run the tests: the hero photo, the pickup step, the basket, two arms at a time, and the page follows whatever sells.",

  // ---------- the week ----------
  week: WEEK,
  videos: MENU,
  titles: WEEK_TITLES,
  slots: SLOTS,
  // the week runs faster as it goes: five times at the start, seven by the
  // last day
  speeds: [5, 5, 5.5, 6, 6.5, 7],
  weekStatus: (day, what) => `Day ${day}: ${what}`,
  weekUploadLengths: ["36 loaves", "24 focaccia", "18 loaves"],

  // ---------- the numbers ----------
  numbers: {
    curve: VISITORS_CURVE,
    final: FINAL,
    // [lead, pow] per tile
    shapes: { views: [0.15, 3.1], subs: [0.1, 4.2], watch: [0.1, 4.4], comments: [0.08, 4.8], revenue: [0.06, 5.2] },
    // the rail tiles this goal needs, and how often each may be told to roll.
    // "subs" carries the order count on this goal (run.js reads stats.subs),
    // so the orders tile pulses with it; revenue is the one money tile the
    // script itself moves. conversion and aov are the store's own KPIs: the
    // live platform counts them, so the demo only asks the rail to redraw
    // them.
    tiles: [
      { id: "series", every: 300, read: "users", tell: "users" },
      { id: "orders", every: 240, read: "subs", tell: "stats" },
      { id: "revenue", every: 420, read: "revenue", tell: "revenue" },
      { id: "conversion", every: 360, read: "revenue", tell: "stats" },
      { id: "aov", every: 440, read: "revenue", tell: "stats" },
    ],
    // the count passing a round number is worth a line in the log
    crossing: { step: 1000, read: "revenue", kind: "sale", text: (thousands) => `Sales crossed $${thousands}k` },
    // the log reads the tiles' own numbers at the close of a day
    dayLine: (day, visitors) => `Day ${day}: ${visitors} visitors so far`,
    gainedLine: (gained) => `${gained} orders placed today`,
  },

  // the demo's own clip, opened in the browser window
  generated: GENERATED,
};

export default script;