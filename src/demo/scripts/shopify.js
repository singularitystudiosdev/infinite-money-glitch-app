// demo/scripts/shopify.js: the store goal, as data. The goal is P16's demo 5,
// verbatim: "Keep my Shopify store's inventory updated from my supplier's CSV
// and answer customer emails" — Shopify and mailbox connected, the first sync
// with a diff, the first customer answered, stock and orders on the rail.
//
// THE CONTRACT'S WORDS ARE THE VIDEO GOAL'S WORDS. run.js reads a fixed
// vocabulary (videos, titles, slots, upload, weekUploadLengths, numbers.final
// .subs/.comments/.watch) and this goal has no uploads. Where the two differ,
// the field keeps its shape and changes its meaning, and the mapping is said
// here once rather than left to be guessed:
//
//   videos[]          one product variant in the store (url = its page on the
//                     store's own host; thumb = the product photo)
//   titles[]          the line the supplier's file moved: "WHIPPER-1 set to 24"
//   slots[]           the three sync windows of the day: 07:00, 12:30, 17:00
//   upload(title,s)   update_inventory: one SKU written at the window s
//   artifact(v,..)    the variant card, opening the store's own product page
//   weekUploadLengths the rows the window moved, so the card reads "2 rows" and
//                     not a runtime
//   numbers.curve     14 days of visitors: the store was selling before the
//                     goal began, so the curve starts at a real level, not zero
//   numbers.final     subs -> orders placed, comments -> emails answered,
//                     watch -> supplier rows synced, revenue -> revenue
//   week              the first week in the store: the second sync, the inbox
//                     the wrong number filled, the column the supplier added,
//                     the SKU the store did not have, and the week's numbers
//   voice.milestone   the recurring sync landing as a voice note (the contract
//                     want an audio artifact here), see the manifest in
//                     assets/demo/shopify-store/
//
// THE TOOLS ARE THE PLATFORM'S OWN. Every tool named here exists: read_file,
// list_products, update_inventory, list_orders, read_inbox, reply_to_customer,
// create_product and schedule (server/tools/platform.js and
// server/connectors/catalog/shopify/tools.js, gmail/tools.js). At runtime a
// connector tool carries its connector id (shopify_update_inventory,
// gmail_reply_email); the demo prints the bare name, the way the bakery and
// outreach scripts do. Three connector facts this script leans on, all from
// the connector's own code: the store host is PER TENANT and stored at
// connect time (catalog/shopify/manifest.js:28-36), so the shop host below is
// the tenant's own and not a fixture; update_inventory is ABSOLUTE, "12 means
// twelve, not twelve more" (catalog/shopify/tools.js:191); and
// reply_to_customer records the answer on the customer's note because the
// Admin API has no outbound buyer message (tools.js:270). The supplier file is
// the sku,quantity export the user attached to the goal, read with read_file.
import { icon } from "../../icons.js";

export const DEMO_ID = "shopify-store";
export const ASSETS = "assets/demo/shopify-store";
// the closing mark and the brand assets, captured once and shared
export const SHARED = "assets/demo";

export const REQUEST = "Keep my Shopify store's inventory updated from my supplier's CSV and answer customer emails";
export const TITLE = "Kestrel Supply";
// the tenant's own store host: the connector stores it on the credential when
// the merchant connects, so this is whatever the merchant named, not a fixture
export const SHOP = "kestrel-supply.myshopify.com";
// the mailbox every customer email arrives in and every answer leaves from
export const MAIL = "orders@kestrel-supply.com";
export const ACCOUNT = SHOP;
// the file the user attached: sku,quantity, the warehouse's own count of what
// is on the shelf. It is the store's stock of record; Shopify is what the
// buyers read. The sync makes the second agree with the first.
export const FILE = "supplier.csv";
export const SUPPLIER = "Kestrel Wholesale";

// the five SKUs in the file and in the store, with what each side said the
// morning the goal ran. Three rows disagree, and one of them is the money
// beat: the warehouse has none left and the store is still selling.
export const SKU_ROWS = [
  { sku: "WHIPPER-1", product: "Whipper harness, blue", shopify: 11, file: 24 },
  { sku: "KILT-2", product: "Kilt chalk bag", shopify: 12, file: 12 },
  { sku: "CAM-3", product: "Cam 3, black", shopify: 9, file: 0 },
  { sku: "RIPCORD-4", product: "Ripcord 4, orange", shopify: 3, file: 7 },
  { sku: "CHALK-5", product: "Chalk, 100 g block", shopify: 50, file: 50 },
];
const MOVED = SKU_ROWS.filter((r) => r.shopify !== r.file);
const UNMOVED = SKU_ROWS.filter((r) => r.shopify === r.file);

// the plan: the file, the diff before the write, the inbox, and what it costs.
// The cost line is the goal's own (contract: a plan carries one) and is the
// platform's own prices (server/pricing.json, checked 2026-09-22): a sync
// reads about 8,000 tokens and writes about 2,000, a reply about 10,000 in and
// 1,500 out, at $3 and $15 a million.
export const PLAN = [
  { title: `Read ${SUPPLIER}'s CSV three times a day`, detail: `${FILE} holds sku,quantity — the warehouse's own count of what is on the shelf. It is read at 07:00, 12:30 and 17:00, and it is the number the store is corrected to.` },
  { title: "Show the diff before anything is written", detail: "Every sync prints each row three ways — what the store holds, what the file says, what will change — and writes only what is on that diff. A row that already agrees is left alone and said so." },
  { title: "Answer the customers the numbers drew", detail: `The mailbox ${MAIL} is connected. An email about an order, a delivery or a product that just went out of stock gets an answer the same day, written from that order and that count, never from a template, and a reply to an order that cannot ship carries the refund with it.` },
  { title: "Stop selling what the warehouse does not have", detail: "A variant the file sets to zero goes to sold out on the storefront in the same run, and a low-stock line lands on the rail before it bites. A file the store has never seen a column in is held, not written." },
  { title: "Estimated cost: about $17 a month", detail: "Three syncs a day at about 8,000 tokens in and 2,000 out is $0.16 a day; eight replies at about 10,000 in is $0.42. At Sonnet's published $3 and $15 a million that is about $17 a month. The Shopify plan and the mailbox are already paid." },
];

export const THINKING = {
  request: ["Reading the brief: a store to keep in stock, a supplier's file, and an inbox", "Reading what the supplier's export actually holds before I let it write anything", "Costing three syncs a day and the day's replies at the platform's own token prices"],
  // the strip's line per beat: the first three are the work's own steps, the
  // last three name the beats after it (run.js reads workStatus[3] before the
  // media block, [4] before the voice and [5] before the render)
  first: [`Reading ${FILE}: five rows, sku and quantity`, "Reading the five variants in the store and what it thinks it holds", "Sorting the rows into what agrees and what does not, before anything is written", "Reading the order and the inbox the store's own numbers drew", "Scheduling the sync for 07:00, 12:30 and 17:00", "Reading the five variants back against the file, then publishing the one that is out"],
};

// the first artifact, worked in full: the file, the store's own count, and the
// diff that becomes the write. A shot is what the agent was looking at.
export const WORK = [
  {
    tool: { name: "read_file", icon: "file-text", args: `path: ${FILE}, source: attached to the goal, header: sku,quantity`, result: `sku,quantity\n${SKU_ROWS.map((r) => `${r.sku},${r.file}`).join("\n")}\n5 rows, 2 columns, unchanged since yesterday` },
    shot: { file: "supplier-csv.png", caption: `${SUPPLIER}'s ${FILE}: five SKUs and the warehouse's count` },
    note: "Five rows and two columns, and the file is the warehouse's own count of the shelf: it is the number the store gets corrected to, not the other way round. A row the supplier leaves at zero is a row the store may not sell.",
  },
  {
    tool: { name: "list_products", icon: "layout-grid", args: `query: sku in ${SKU_ROWS.map((r) => r.sku).join(", ")}, fields: sku, inventoryQuantity, status`, result: `${SKU_ROWS.map((r) => `${r.sku}  ${r.product}  on hand ${r.shopify}`).join("\n")}\n5 products, all ACTIVE, all tracking inventory\nvendor: ${SUPPLIER}` },
    shot: { file: "shopify-admin-products.png", caption: `Shopify Products: the five SKUs and what the store thinks it holds` },
    note: "The store and the file disagree on three rows. CAM-3 is the one that matters: the store says nine, the warehouse says none, and every one of those nine is an order the store would take and could not ship.",
  },
  {
    tool: { name: "update_inventory", icon: "sliders-vertical", args: `${MOVED.map((r) => `${r.sku} ${r.shopify} → ${r.file}`).join("\n")}\nreason: supplier sync (${FILE})\nleft alone: ${UNMOVED.map((r) => r.sku).join(", ")}`, result: `${MOVED.map((r) => `${r.sku}  set to ${r.file}  read back ${r.file}`).join("\n")}\n3 of 5 rows written, 2 already agreed\nCAM-3 now reads Sold out on the product page` },
    shot: { file: "sync-diff.png", caption: `The diff, then the write: three rows to move, two already right` },
    note: "There is the diff: WHIPPER-1 eleven against the warehouse's twenty-four, RIPCORD-4 three against seven, and CAM-3 nine against none. Only the three that disagree were written, and the two that already agreed were left exactly as they were.",
  },
];

// the rest of the morning: the order the wrong number took, the inbox it
// filled, the answer, and the store read back. run.js draws one card and one
// shot per item here, then the single note below
export const MORNING = [
  { tool: { name: "list_orders", icon: "receipt", args: "query: financial_status:paid, newest: 5", result: "5 orders this morning\n#1042 · Maya Iyer · 1 × CAM-3 · $84.00 · paid 08:12\n#1041 · 1 × WHIPPER-1 · $96.00 · paid 07:58\n#1040 · 2 × CHALK-5 · $18.00 · paid 07:41\n1 of the 5 cannot ship" }, shot: { file: "order-admin.png", caption: "Orders: the first one that morning, and the cam it cannot ship" } },
  { tool: { name: "read_inbox", icon: "inbox", args: `mailbox: ${MAIL}, is:unread, newer: 6h`, result: `3 unread\nMaya Iyer, 08:19 · "is the cam-3 shipping this week?"\n2 × "when is chalk back?"\n0 answered yet` }, shot: { file: "customer-email.png", caption: "Gmail: the customer whose order the zero cam took" } },
  { tool: { name: "reply_email", icon: "mail", args: `mailbox: ${MAIL}, order: #1042, to: Maya Iyer, same thread, message: 74 words — the cam is out, the charge is refunded, the harness ships today, chalk Thursday`, result: `sent 08:41\nthread: the one she wrote in\nrefund queued: $84.00, same method` }, shot: { file: "customer-reply.png", caption: "The reply: the refund, and when the rest ships" } },
  { tool: { name: "list_products", icon: "activity", args: "sort: inventory ascending, fields: sku, inventoryQuantity, status", result: "CAM-3 0, sold out\nRIPCORD-4 7\nKILT-2 12\nWHIPPER-1 24\nCHALK-5 50\n1 variant at zero, 0 below the low-stock line of 5" }, shot: { file: "stock-levels.png", caption: "Stock: the zero the file wrote, and nothing else near the line" } },
];
export const MORNING_NOTE = "One order had already been taken for a cam the warehouse does not have, and it was the first email of the day. The refund is $84 and a customer who will read the count before she orders again.";
export const MORNING_INSIGHT = { kind: "insight", text: "CAM-3 went to zero at 07:04; its first email arrived at 08:19. One stale row cost an hour of a morning", delta: 21 };

export const VOICE = {
  tool: { name: "schedule", icon: "calendar-clock", args: `job: sync ${FILE}, at: 07:00, 12:30, 17:00, write: only what the diff shows, hold: on a column the file has not had before`, result: "scheduled\nnext run 12:30\nwrites nothing until the diff is on screen" },
  shot: { file: "sync-scheduled.png", caption: "The sync on the schedule: the file at 07:00, 12:30 and 17:00" },
  milestone: { title: "Sync scheduled", text: "3 a day · the supplier's file · the diff first, always", src: "sync.m4a", icon: "calendar-clock", media: "audio", mediaTitle: "Sync note" },
};

// the last read before the store is left alone: the five variants against the
// file, so the week starts from two numbers that agree
export const RENDER = { name: "list_products", icon: "check-check", args: `query: sku in ${SKU_ROWS.map((r) => r.sku).join(", ")}, compare: ${FILE}`, result: "5 of 5 match the file\n0 rows left to write\nCAM-3 sold out on the storefront, 4 rows unchanged" };
export const UPLOAD = (title, slot = "07:00") => ({ name: "update_inventory", icon: "sliders-vertical", args: `line: "${title}", window: ${slot}, source: ${FILE}, reason: supplier sync`, result: `applied at ${slot}\ninventory set to the file's count\nread back from the store, reason: supplier sync (${FILE})` });

// the three times a day the warehouse file is read and the store corrected
export const SLOTS = ["07:00", "12:30", "17:00"];

// the week: the second sync, the inbox the wrong number filled, the column the
// supplier added overnight, the SKU the store never had, and the week's own
// numbers. Each day is the tool calls the agent ran and the one thing it learnt
export const WEEK = [
  { day: 2, tools: [{ name: "read_file", icon: "file-text", args: `path: ${FILE}, rows: 5`, result: "2 rows changed\nWHIPPER-1 24 → 19\nCHALK-5 50 → 34" }, { name: "update_inventory", icon: "sliders-vertical", args: `2 SKUs, reason: supplier sync (${FILE})`, result: "set: 2\nmismatches left: 0" }], note: "Two rows moved in the 07:00 sync and neither needed me: four harnesses and sixteen blocks of chalk went out, the file said so, and the store said so a minute later. The file is the number the store is checked against, never the other way round." },
  { day: 3, tools: [{ name: "read_inbox", icon: "inbox", args: "is:unread, newer: 24h", result: "11 emails\n4 about the cam we set to zero\n2 delivery dates, 1 return, 4 about chalk" }, { name: "reply_email", icon: "mail", args: `mailbox: ${MAIL}, 4 threads, one answer, sent to each in the thread they wrote in`, result: "sent: 4\nsame answer, four threads\n0 unanswered" }], note: "Four of the eleven emails are the same question about the cam. A wrong number takes a second to write and an hour of customer email to undo, which is the whole reason the sync runs before the inbox does." },
  { day: 4, tools: [{ name: "list_orders", icon: "receipt", args: "query: financial_status:paid, days: 4", result: "46 orders, $3,980\nCAM-3: 9 sold while the store was wrong" }, { name: "reply_to_customer", icon: "mail", args: "order: #1038, refund: $84.00, note: the cam was out when it sold", result: "recorded on the customer's note\nrefund: $84.00, same method" }], note: "Nine cams sold in the days the store overcounted and one of them could not ship. The refund is the price of a stale row: $84 and a customer who checks the count before she orders again." },
  { day: 5, tools: [{ name: "read_file", icon: "file-text", args: `path: ${FILE}, header: true`, result: "sku,quantity,warehouse\n5 rows, a third column the sync has never seen" }, { name: "update_inventory", icon: "sliders-vertical", args: "map: warehouse → the location the row ships from, quantities from column 2, re-run", result: "5 rows re-read\n0 rows changed, 0 writes" }], note: "The supplier's export grew a column overnight and the sync held the write instead of renumbering the store from a file it had not read before. An unread column is how a file quietly moves your stock; it gets mapped before the next run writes anything." },
  { day: 6, tools: [{ name: "read_file", icon: "file-text", args: `path: ${FILE}, rows: 6`, result: "GRIGRI-6, 10 — a SKU the store has never had" }, { name: "create_product", icon: "plus", args: "title: Grigri 6, sku: GRIGRI-6, status: DRAFT, quantity: 10", result: "created as DRAFT\nthe row is written when it is published" }], note: "A sixth row arrived with a SKU the store has never sold: next week's delivery. It went in as a draft, so the file and the store agree again without an unphotographed product going live on the storefront." },
  { day: 7, tools: [{ name: "list_orders", icon: "receipt", args: "source: the store, days: 7", result: "118 orders, $6,420\naverage order $54.40\nCAM-3: 1 refunded, 0 returned" }, { name: "read_inbox", icon: "inbox", args: "since: Monday, unanswered: 0", result: "96 emails, 96 answered\nmedian answer 41 minutes\n4 asked about the cam, 0 are still waiting" }], note: "Week one: 118 orders, 96 emails answered, 74 supplier rows read and 9 variants corrected. The report names the two SKUs whose wrong number cost the most email, and next week the 07:00 sync runs before the inbox is even read." },
];

// the lines the three daily syncs land as: the SKU, and what the file moved it
// to. The week's cards cycle through them, so no two cards repeat
export const WEEK_TITLES = ["WHIPPER-1 set to 24", "CAM-3 set to 0, sold out", "RIPCORD-4 set to 7", "CHALK-5 set to 34", "KILT-2 unchanged at 12", "WHIPPER-1 set to 19", "CHALK-5 set to 28", "GRIGRI-6 drafted at 10", "RIPCORD-4 set to 3", "CAM-3 restocked at 24", "KILT-2 set to 9", "CHALK-5 set to 22", "WHIPPER-1 set to 15", "CAM-3 set to 4", "RIPCORD-4 set to 11", "CHALK-5 set to 40", "KILT-2 set to 6", "WHIPPER-1 set to 24", "CAM-3 set to 0, sold out", "RIPCORD-4 set to 2", "GRIGRI-6 published at 10"];


// the store's own product pages: each SKU the sync line card opens, and the
// photo under thumbs/ that goes with it (the platform's own generated product
// shots, the way the bakery demo's 21 are: fal.ai, nano-banana-2, prompts in
// thumbs-prompts.txt). run.js drops a thumbnail that is not on disk yet, so a
// missing photo costs the card its image and never a broken one
const HANDLES = ["whipper-harness", "kilt-chalk-bag", "cam-3", "ripcord-4", "chalk-100g"];
export const SKUS = SKU_ROWS.map((r, i) => ({ id: r.sku, sku: r.sku, url: `https://${SHOP}/products/${HANDLES[i]}`, thumb: `thumbs/${HANDLES[i]}.jpg` }));

// the first thing the browser window shows once it is on disk: a screen
// capture of the 07:00 sync, the diff filling in row by row
export const GENERATED = { file: "first-sync.webm", seconds: 6 };

// the opening line, on the brand green before anything else is drawn
export const QUOTE = { text: "“Beware of little expenses; a small leak will sink a great ship.”", by: "- Benjamin Franklin" };
// the sign-off: the mark, then the name
export const OUTRO = { logo: "dawn-mark.png", name: "DAWN" };

// where the numbers end up: 14 days of visitors for a store that was already
// selling before the goal began, so the curve starts at a real level. Week one:
// 118 orders at $6,420, 96 emails answered, 74 supplier rows read, 9 variants
// corrected.
export const VISITORS_CURVE = [120, 160, 185, 210, 235, 260, 290, 320, 355, 390, 430, 470, 520, 575];
export const FINAL = { subs: 118, comments: 96, watch: 74, revenue: 6420 };

// ---------- the script run.js plays ----------

// numbers.shapes: [lead, pow] per tile. A store that was already selling moves
// from the first day, so every lead is high and the curves turn early. Sizes
// (watch, comments) and the money have their own lead and turn, so the tiles
// never move in step.
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
  planSay: (title) => `Here is the plan for ${title}. It reads ${SUPPLIER}'s ${FILE} three times a day, shows you the diff before anything is written, and answers the customer email those numbers draw. Change anything, or approve it and I start.`,

  // ---------- the account the goal needs ----------
  // The store is the account that needs the merchant's own sign-in: the OAuth
  // app is per store and the host is stored on the credential. The mailbox is
  // the second connector the goal needs and it is connected in the setup
  // steps, not here — the popup asks for one thing at a time (run.js scene 3).
  // The mark is the icon set's product grid: the icon set carries no store
  // glyph, and a name it lacks is an ellipsis and a console warning
  // (ui/chat.js:253-263), never a brand mark.
  connect: {
    probe: "shopify",
    platform: "Shopify",
    mark: "layout-grid",
    auth: "oauth2",
    title: "Connect Shopify",
    url: "/api/connect/shopify/start",
    say: `Good, that is the plan. Two things from you: the store's own sign-in, so the sync writes to your Shopify and to nobody else's, and then the mailbox. I keep the token, never the password.`,
    statusOpening: "Opening the store admin",
    statusWaiting: "Waiting on Shopify approval",
    log: (account) => `Shopify connected as ${account}`,
  },
  account: ACCOUNT,

  // ---------- the setup the goal needs, and the rail it lands on ----------
  setup: {
    status: "Connecting the store and the inbox",
    line: (c) => `Store connected: **${c.shop}**, with **${FILE}** as the file it syncs from. Stock, orders and the inbox are on the right. The sync runs at ${c.slots.join(", ")}; starting on the first one.`,
    log: (c) => `Store connected: ${c.shop} (${c.rows} SKUs matched to ${FILE})`,
    done: ["shopify", "gmail", "card"],
    summary: { shopify: `Store ${SHOP}, 5 SKUs matched`, gmail: `Mailbox ${MAIL}`, card: "Visa ending 4242" },
    account: ACCOUNT,
    shop: SHOP,
    rows: SKU_ROWS.length,
    slots: SLOTS,
    missions: [
      { id: "demo-csv-sync", title: "The supplier's file, three times a day", site: "Shopify", url: "https://admin.shopify.com", icon: "file-text", progress: 22, steps: [`Reading ${FILE} and the store's five variants`, "Showing the diff before any write", "Writing the three SKUs that disagree", "Holding the write when the file gains a column"] },
      { id: "demo-inbox", title: "Every customer email answered", site: "Gmail", url: "https://mail.google.com", icon: "mail", progress: 12, steps: ["Reading the inbox the sold-out cam filled", "Answering from the order and the stock", "Refunding the order that cannot ship", "Keeping the answer in the same thread"] },
      { id: "demo-stock", title: "Stock the storefront can trust", site: "Shopify", url: "https://admin.shopify.com", icon: "layout-grid", progress: 0, steps: ["Setting the zero variant to sold out", "Reading low stock before it bites", "Flagging the SKU the file does not know", "Drafting the reorder from sell-through"] },
    ],
    tool: { name: "list_products", icon: "layout-grid", args: `store: ${SHOP}, match: ${FILE} by sku, mailbox: ${MAIL}`, result: `shopify: connected, per-store OAuth 2, scopes read/write products, inventory, orders, customers\n${FILE}: ${SKU_ROWS.length} rows, ${SKU_ROWS.length} SKUs matched\ngmail: connected, ${MAIL}` },
    // how far the rail's missions move at each beat of the story
    steps: { first: 22, upload: 28, more: 17, week: 28 },
  },

  // ---------- the first artifact, worked in full ----------
  work: WORK,
  workStatus: THINKING.first,
  workLog: `Read ${FILE} against the store and wrote the 3 SKUs that disagreed`,
  workSay: "The file and the store disagree on three rows, and CAM-3 is the one that matters: the store says nine, the warehouse says none. Writing only the three the diff shows, and answering the email that order already wrote.",
  // the rest of the morning, in the slot the video goal uses for its
  // generation screens: the order, the inbox, the answer and the read-back
  media: MORNING,
  mediaNote: MORNING_NOTE,
  mediaInsight: MORNING_INSIGHT,
  voice: VOICE,
  voiceLog: "Supplier sync scheduled, three times a day",
  render: RENDER,
  // the first sync line's own size, on its own card and in the log line
  firstLength: "3 SKUs",
  // the activity-log kinds this goal's lines are filed under, so a store's
  // orders never land under a channel's "video" tab
  logs: { upload: "order", day: "view", delta: "order" },
  // the sync line and the variant card it becomes
  upload: UPLOAD,
  artifact: (v, title, slot, length) => ({ url: v.url, thumb: `${ASSETS}/${v.thumb}`, title: `Synced: ${title}`, mark: icon("layout-grid"), meta: `${v.sku} · ${slot} · ${length}` }),
  liveSay: (title, url, slot) => `It is in the store: [${title}](${url}). The 12:30 and 17:00 syncs are already queued off the same file, and Maya's answer went out with the new count.`,
  status: { cutting: "Running the 12:30 sync", readingWeek: "Reading the week's stock and inbox", waiting: "Waiting on the plan" },

  // ---------- the next syncs, before the week ----------
  more: [
    { video: SKUS[4], title: WEEK_TITLES[3], slot: SLOTS[1], length: "2 rows", gen: { name: "read_file", icon: "file-text", args: `path: ${FILE}, rows: 5`, result: "2 rows changed\nWHIPPER-1 24 → 19\nCHALK-5 50 → 34" }, voice: { name: "update_inventory", icon: "sliders-vertical", args: `CHALK-5 50 → 34, reason: supplier sync (${FILE})`, result: "inventoryQuantity: 34" }, numbers: 0.05 },
    { video: SKUS[3], title: WEEK_TITLES[8], slot: SLOTS[2], length: "1 row", gen: { name: "read_file", icon: "file-text", args: `path: ${FILE}, rows: 5`, result: "1 row changed\nRIPCORD-4 7 → 3" }, voice: { name: "update_inventory", icon: "sliders-vertical", args: `RIPCORD-4 7 → 3, reason: supplier sync (${FILE})`, result: "inventoryQuantity: 3" }, numbers: 0.08 },
  ],
  moreStatus: (slot) => `Running the ${slot} sync`,
  weekIntro: "Three syncs a day from here. From now on it is what the file teaches: the rows that move on their own, the inbox a wrong number fills, a column the supplier adds, and the SKU the store has never sold.",

  // ---------- the week ----------
  week: WEEK,
  videos: SKUS,
  titles: WEEK_TITLES,
  slots: SLOTS,
  // the week runs faster as it goes: five times at the start, seven by the
  // last day
  speeds: [5, 5, 5.5, 6, 6.5, 7],
  weekStatus: (day, what) => `Day ${day}: ${what}`,
  weekUploadLengths: ["3 SKUs", "2 rows", "1 row"],

  // ---------- the numbers ----------
  numbers: {
    curve: VISITORS_CURVE,
    final: FINAL,
    // the stats run.js carries toward their closing numbers, each on its own
    // shape: subs is the orders this goal places, comments the customer emails
    // it answers, watch the supplier rows it syncs. The contract's own names
    // are kept for the numbers a goal with videos would have.
    stats: { subs: FINAL.subs, comments: FINAL.comments, watch: FINAL.watch },
    // [lead, pow] per tile
    shapes: { views: [0.32, 2.3], subs: [0.3, 2.4], watch: [0.28, 2.7], comments: [0.26, 3], revenue: [0.3, 2.5] },
    // the rail tiles this goal needs, and how often each may be told to roll.
    // The ids are the store kind's own (src/kinds.js store tiles) and the read
    // is the stat run.js keeps for it, so orders and the money on the rail are
    // this goal's own numbers. The stock KPIs the connector exposes
    // (stock_outs, stock_low: catalog/shopify/metrics.js:105-126) arrive as
    // metricTiles on a live project; the client sim has no tile to draw them
    // on, so the sim's stock story is carried by the log lines and the week.
    tiles: [
      { id: "series", every: 220, read: "users", tell: "users" },
      { id: "orders", every: 200, read: "subs", tell: "stats" },
      { id: "revenue", every: 420, read: "revenue", tell: "revenue" },
      { id: "conversion", every: 360, read: "subs", tell: "stats" },
      { id: "aov", every: 440, read: "subs", tell: "stats" },
    ],
    // the count passing a round number is worth a line in the log
    crossing: { step: 1000, read: "revenue", kind: "sale", text: (thousands) => `Sales crossed $${thousands}k` },
    // the log reads the tiles' own numbers at the close of a day
    dayLine: (day, visitors) => `Day ${day}: ${visitors} visitors so far`,
    gainedLine: (gained) => `${gained} orders placed today`,
  },

  // the demo's own clip, opened in the browser window
  generated: GENERATED,
  // the address the browser window frames when the clip is not on disk: the
  // product's own page on the store's host, which is what the card opens
  embedUrl: (sku) => SKUS.find((s) => s.sku === sku)?.url || `https://${SHOP}`,
};

export default script;