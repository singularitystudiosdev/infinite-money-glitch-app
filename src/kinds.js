// kinds.js: what a project is, and therefore what its right-hand column
// measures and what its agent does all day. One entry a kind: the series
// the graph draws, the tiles under it, the work the agent runs between
// asks, and the questions it stops to ask. Every project carries a kind;
// the panel, the stream and the sim all read it from here.

// a tile: id, label, how it is written (money, num, pct), where a fresh
// project's number starts relative to its revenue, and how the sim moves it
const money = (id, label, share) => ({ id, label, format: "money", share });
const num = (id, label, share, tick) => ({ id, label, format: "num", share, tick });
const pct = (id, label, base, tick) => ({ id, label, format: "pct", base, tick });

// an event the kind raises now and then, landing in the log under its own
// kind (a video, a lead, an order); the Updates card's tabs are these
// kinds. {n} is a small count, {money} an amount, {name} a person
const ev = (kind, ...texts) => ({ kind, texts });
const NAMES = ["Maya", "Jonas", "Priya", "Tom", "Lena", "Arif", "Sofia", "Ken"];
export function eventText(text, rnd = Math.random) {
  return text
    .replace(/\{n\}/g, () => String(2 + Math.floor(rnd() * 38)))
    .replace(/\{money\}/g, () => `$${(80 + Math.floor(rnd() * 820)).toLocaleString("en-US")}`)
    .replace(/\{name\}/g, () => NAMES[Math.floor(rnd() * NAMES.length)]);
}

export const KINDS = {
  saas: {
    label: "Product",
    updates: [["signup", "Sign-ups"], ["sale", "Sales"], ["insight", "Insights"]],
    events: [ev("signup", "{n} new sign-ups in the last hour", "A team of {n} signed up from the pricing page", "{n} trials started today, {n} from the follow-up email")],
    hint: "Sign-ups, active users and the revenue they turn into.",
    series: { label: "Active users", perDay: 60 },
    tiles: [money("revenue", "Monthly revenue"), money("adSpend", "Ad spend", 0.12), num("signups", "Sign-ups this month", 0.05, [1, 4]), pct("conversion", "Checkout conversion", 4.1, [-0.1, 0.15]), money("newMrr", "New MRR", 0.08), num("churned", "Churned this month", 0.002, [0, 1])],
    work: [
      { thought: "The checkout change shipped yesterday. Reading conversion by day before I say whether it held.", tools: [{ name: "read_funnel", icon: "activity", args: "step: checkout, days: 3", result: "Sep 11: 3.6%\nSep 12: 4.1%\nSep 13: 4.2%" }], say: "Checkout is holding above 4% for a second day. Leaving it alone and watching [the funnel](https://analytics.google.com) one more." },
      { thought: "Sign-ups from mobile Safari dropped by half on Sep 11. Checking whether desktop moved the same day before I call it a client bug.", tools: [{ name: "read_signups", icon: "user", args: "by: client, days: 4", result: "mobile safari: 61 → 29\ndesktop: 140 → 138\nandroid chrome: 52 → 55" }, { name: "read_errors", icon: "circle-alert", args: "client: mobile safari, since: Sep 11", result: "TypeError in signup.js:212, 208 hits" }], say: "It is a client bug: one TypeError on Safari since the 11th. [Filed it](https://github.com/singularitystudiosdev/infinite-money-glitch/issues) with the stack and the hit count." },
      { thought: "Ad spend is 40% of the daily cap by noon. Reading the cost per sign-up before I decide whether that pace is fine.", tools: [{ name: "read_ads", icon: "zap", args: "campaign: main, today", result: "spend: $38 of $90\ncost per sign-up: $2.10 (yesterday $2.60)\nsign-ups: 18" }], say: "Sign-ups are cheaper than yesterday, so the pace is fine. Leaving [the cap](https://ads.google.com) where it is." },
      { thought: "Returning users read the pricing page twice before buying. Checking whether the second visit is where the sale happens.", tools: [{ name: "read_paths", icon: "compass", args: "page: pricing, converting: true", result: "1 visit: 2.1% convert\n2 visits: 6.4% convert\n3+: 6.1%" }], say: "The second pricing visit converts three times the first. Drafting [a follow-up email](https://mail.google.com/mail/#drafts) that links straight to it." },
    ],
    asks: [{ question: "Ad spend is at the daily cap by 3pm. Raise it by $20 for today?", options: [{ label: "Raise by $20", note: "Once, today only" }, { label: "Keep the cap", note: "Spend resumes tomorrow" }] }],
  },
  channel: {
    label: "YouTube channel",
    updates: [["video", "Videos"], ["subscriber", "Subscribers"], ["view", "Views"]],
    // the full Activity card's tabs: each names the log kinds it shows, so
    // Breakthroughs gathers the milestones (subscribers crossing a mark, the
    // day's views, a mission done) that a channel's owner reads first
    activity: [["video", "Videos", ["video"]], ["breakthrough", "Breakthroughs", ["subscriber", "view", "mission"]], ["insight", "Insights", ["insight"]]],
    events: [
      ev("video", "New video is live: Bali cliff sunrise, 8:12", "Uploaded: the temple short, 0:58", "A short went out at Tuesday 18:00", "Uploaded as unlisted: the sponsor cut, 6:40"),
      ev("subscriber", "Subscribers crossed {n}k", "{n} new subscribers this week", "A short brought in {n} subscribers overnight"),
      ev("view", "Video 41 passed {n}k views", "The channel passed {n}k views this month", "Sunday's upload passed {n}k views in a day"),
    ],
    hint: "Videos, shorts and the ads that drive them.",
    series: { label: "Views", perDay: 900 },
    tiles: [money("revenue", "Monthly revenue"), num("subs", "Subscribers", 0.9, [1, 6]), num("watch", "Watch hours", 0.6, [1, 8]), money("adSpend", "Ad spend", 0.1), money("sponsor", "Sponsor income", 0.2), num("comments", "Comments", 0.05, [0, 3])],
    work: [
      { thought: "The last upload's retention dips at 0:40. Checking whether the intro is the cause before I cut anything.", tools: [{ name: "read_retention", icon: "activity", args: "video: [latest](https://studio.youtube.com/channel/videos), window: 60s", result: "drop at 0:38: -22%\nintro length: 41s\naverage view: 3:12" }], say: "The intro runs long. Trimming [the next one](https://studio.youtube.com/channel/videos/upload) to 20 seconds and watching retention on it." },
      { thought: "Two new comments ask the same question. Reading them both before I answer, so one reply covers both.", tools: [{ name: "list_comments", icon: "mail", args: "since: 1h, unread: true", result: "- \"Where is this?\" (2 likes)\n- \"which temple??\"\n- \"great video\"" }, { name: "post_reply", icon: "check", args: "count: 2", result: "posted: 2\ntext: \"Pura Luhur Uluwatu, on the south cliffs.\"" }], say: "Answered both [location questions](https://studio.youtube.com/channel/comments) with one line and left the third comment alone." },
      { thought: "A thumbnail test has run for six hours. Checking whether one variant is ahead by enough to call it.", tools: [{ name: "read_experiment", icon: "compass", args: "test: thumbnail-3, min_confidence: 0.9", result: "A: 6.1% ctr (1,204 impressions)\nB: 7.8% ctr (1,188 impressions)\nconfidence: 0.93" }, { name: "set_thumbnail", icon: "image", args: "variant: [B](https://studio.youtube.com/channel/videos)", result: "applied to video 41" }], say: "Variant B won at 93% confidence. It is [the thumbnail](https://studio.youtube.com/channel/videos) now; the test is closed." },
      { thought: "Watch time by hour says the audience is awake in the evening. Checking whether the schedule still matches that.", tools: [{ name: "read_schedule", icon: "calendar-clock", args: "next: 3", result: "Tue 18:00\nFri 18:00\nSun 10:00" }, { name: "read_watch_time", icon: "activity", args: "by: hour, days: 30", result: "peak: 18:00 to 21:00\nSun 10:00: 41% of peak" }], say: "Sunday morning is the weak slot. Moving [that upload](https://studio.youtube.com/channel/videos/upload) to Sunday 18:00." },
      { thought: "One render finished with a warning about the audio track. Listening to the last ten seconds before I upload it.", tools: [{ name: "inspect_render", icon: "clapperboard", args: "job: render-19, range: -10s", result: "peak: -0.3 dB\nclipping: none\nwarning: sample rate 44.1k, expected 48k" }], say: "The warning is a sample-rate mismatch, not clipping. Resampling and [uploading as unlisted](https://studio.youtube.com/channel/videos/upload)." },
    ],
    asks: [
      { question: "The new thumbnail is ready. Ship it now or hold it for the Friday upload?", options: [{ label: "Ship it now", note: "Replaces the current one" }, { label: "Hold for Friday", note: "Goes out with the next video" }] },
      { question: "The sponsor's clip is 20 seconds; the contract says 15. Run the full clip?", options: [{ label: "Run the full clip", note: "Ask the sponsor after" }, { label: "Cut it to 15", note: "As the contract says" }] },
    ],
  },
  outreach: {
    label: "Outreach bot",
    updates: [["lead", "Leads"], ["sale", "Sales"], ["insight", "Insights"]],
    events: [ev("lead", "New lead: {name} replied in Founder Coffee", "{n} warm replies since the morning", "{name} booked a call for Thursday", "New lead: {name} asked for the plan page")],
    hint: "A Discord bot that finds people, opens the conversation and closes the sale.",
    series: { label: "Impressions", perDay: 400 },
    tiles: [money("revenue", "Revenue"), num("contacts", "Contacts reached", 0.4, [2, 9]), num("replies", "Replies", 0.08, [0, 2]), num("meetings", "Meetings booked", 0.012, [0, 1]), pct("replyRate", "Reply rate", 12.5, [-0.2, 0.3])],
    work: [
      { thought: "Three servers added the bot overnight. Reading their intro channels before I say anything, so the first line fits each one.", tools: [{ name: "list_servers", icon: "inbox", args: "joined: 24h", result: "- Indie Hackers Bali (2,140 members)\n- No-Code Builders (860)\n- Founder Coffee (410)" }, { name: "read_channel", icon: "file-text", args: "channel: [#introductions](https://discord.com/channels/@me), last: 40", result: "most common asks: landing pages, Stripe setup, first customers" }], say: "First customers is what all three ask about. Opening with [the case study](https://notion.so), not the price." },
      { thought: "Forty people replied to yesterday's opener. Sorting them by intent before I answer anyone.", tools: [{ name: "read_replies", icon: "mail", args: "since: 24h", result: "interested: 14\nquestions: 19\nnot now: 7" }, { name: "send_dm", icon: "check", args: "to: interested, template: [demo-link](https://notion.so)", result: "sent: 14\nbounced: 0" }], say: "Fourteen warm replies got [the demo link](https://notion.so). The nineteen with questions get a written answer each, next." },
      { thought: "One contact asked whether the plan includes the Notion export. Reading the plan page before I answer, so I quote it rather than guess.", tools: [{ name: "read_document", icon: "file-text", args: "doc: [pricing.md](https://notion.so), query: export", result: "Pro: CSV and Notion export\nStarter: CSV only" }, { name: "send_dm", icon: "check", args: "to: [@maya_builds](https://discord.com/channels/@me)", result: "sent" }], say: "Told [Maya](https://discord.com/channels/@me) the Notion export is on Pro, with [the link](https://notion.so). She asked for [the checkout](https://dashboard.stripe.com/payment-links)." },
      { thought: "The opener with the question in it got twice the replies of the one with the offer. Reading the numbers before I switch every server to it.", tools: [{ name: "read_experiment", icon: "compass", args: "test: opener-2, min_confidence: 0.9", result: "A (offer): 4.1% reply (620 sent)\nB (question): 8.9% reply (615 sent)\nconfidence: 0.97" }, { name: "set_template", icon: "sliders-vertical", args: "opener: B", result: "applied to 11 servers" }], say: "The question opener won at 97% confidence. [Every server](https://discord.com/channels/@me) uses it from the next batch." },
      { thought: "A sale closed from the Founder Coffee server. Writing the receipt and checking which opener the contact first saw.", tools: [{ name: "read_contact", icon: "user", args: "id: [c_8812](https://dashboard.stripe.com/customers)", result: "first seen: Sep 9, opener B\nreplies: 3\nplan: Pro, $49/mo" }], say: "Pro plan, closed in four days from the first message. [Logging the path](https://notion.so) so the next one is faster." },
      { thought: "One server's moderator asked the bot to slow down. Reading the rules channel before I change the rate for that server.", tools: [{ name: "read_channel", icon: "file-text", args: "channel: [#rules](https://discord.com/channels/@me), server: No-Code Builders", result: "\"No unsolicited DMs more than once a week.\"" }, { name: "set_rate", icon: "sliders-vertical", args: "server: No-Code Builders, max: 1/week", result: "applied" }], say: "That server allows one DM a week. The bot follows it now; the moderator has [a reply](https://discord.com/channels/@me) saying so." },
    ],
    asks: [
      { question: "Fourteen contacts asked for a discount. Offer 20% off the first month?", options: [{ label: "Offer 20% off", note: "First month only" }, { label: "Hold the price", note: "Send the case study instead" }] },
      { question: "A server with 9,000 members allows bots but bans sales DMs. Join it for the public channels only?", options: [{ label: "Join, public only", note: "No DMs in that server" }, { label: "Skip it", note: "Stay with the eleven servers" }] },
    ],
  },
  store: {
    label: "Online store",
    updates: [["order", "Orders"], ["sale", "Sales"], ["insight", "Insights"]],
    events: [ev("order", "Order #{n}{n}, {money}", "{n} orders since midnight", "The blue variant sold out", "Order #{n}{n} shipped to {name}")],
    hint: "A product, a checkout and the payouts.",
    series: { label: "Visitors", perDay: 300 },
    tiles: [money("revenue", "Revenue"), num("orders", "Orders", 0.02, [0, 2]), pct("conversion", "Conversion", 3.2, [-0.1, 0.15]), money("aov", "Average order", 0.0045), num("returns", "Returns", 0.0005, [0, 1])],
    work: [
      { thought: "Cart abandonment rose two points this week. Reading where in the checkout people leave before I change anything.", tools: [{ name: "read_funnel", icon: "activity", args: "step: checkout, days: 7", result: "address: -8%\nshipping: -21%\npayment: -6%" }], say: "The shipping step is where they leave. The rate shows late; moving it to [the cart page](https://admin.shopify.com)." },
      { thought: "A new spot landed in the ad gallery. Rebuilding the manifest with it and checking every thumbnail loads.", tools: [{ name: "build_manifest", icon: "file-text", args: "entries: 41", result: "written: manifest.json\nnew: 1" }, { name: "check_assets", icon: "check", args: "count: 41", result: "200: 41\nmissing: 0" }], say: "Forty-one entries, every asset answers 200. [The gallery page](https://singularitystudiosdev.github.io/superbot-ad-gallery/) is live with the new spot." },
      { thought: "Click-through across the last five ads: the short one wins. Reading why before I brief the next one.", tools: [{ name: "read_ads", icon: "zap", args: "last: 5, metric: ctr", result: "15s cut: 2.4%\n30s cut: 1.1%\nstatic: 0.8%" }], say: "The 15-second cut doubles the 30. [The next brief](https://notion.so) asks for two more that length." },
      { thought: "One order was paid twice. Reading the payment log before I refund, so I refund the right charge.", tools: [{ name: "read_payments", icon: "receipt", args: "order: #4412", result: "ch_1: $84.00 succeeded\nch_2: $84.00 succeeded (retry, 4s later)" }, { name: "refund", icon: "check", args: "charge: [ch_2](https://dashboard.stripe.com/payments)", result: "refunded $84.00" }], say: "The retry double-charged. Refunded [the second charge](https://dashboard.stripe.com/payments) and wrote the customer a line about it." },
    ],
    asks: [{ question: "Stock of the blue variant is at 6. Reorder 200 now or wait for the weekend numbers?", options: [{ label: "Reorder 200", note: "Lands in 9 days" }, { label: "Wait for Monday", note: "Risk a stock-out" }] }],
  },
  ops: {
    label: "Revenue ops",
    updates: [["payout", "Payouts"], ["invoice", "Invoices"], ["insight", "Insights"]],
    events: [ev("payout", "Payout po_{n}{n} matched, {money}", "Stripe paid out {money}; every line matched"), ev("invoice", "Invoice INV-00{n} paid, {money}", "Past-due reminder sent to {name}", "Invoice INV-00{n} sent to {name}")],
    hint: "Invoices, payouts and the forecast they feed.",
    series: { label: "Cash collected", perDay: 1400, format: "money" },
    tiles: [money("revenue", "Collected this month"), num("matched", "Payouts matched", 0.004, [0, 1]), num("overdue", "Past due", 0.0002, [-1, 1]), num("invoices", "Invoices sent", 0.003, [0, 1])],
    work: [
      { thought: "Stripe paid out $4,120 overnight. Matching it against the open invoices before I touch the forecast.", tools: [{ name: "read_payout", icon: "receipt", args: "id: [po_8812](https://dashboard.stripe.com/payouts)", result: "amount: $4,120\ninvoices: INV-0212, INV-0215, INV-0218\nunmatched: $0" }], say: "Every dollar of [the payout](https://dashboard.stripe.com/payouts) matches an invoice. Three invoices closed." },
      { thought: "A payout landed that is $40 short of the invoice. Reading the memo before I guess why.", tools: [{ name: "read_payout", icon: "receipt", args: "id: [po_8819](https://dashboard.stripe.com/payouts)", result: "amount: $1,160\ninvoice: $1,200\nmemo: \"less chargeback fee\"" }], say: "The gap is a chargeback fee, not a missed payment. Noting it against [the invoice](https://dashboard.stripe.com/invoices)." },
      { thought: "Two invoices are past due. Drafting the reminders in the client's tone, from the last thread with each.", tools: [{ name: "list_invoices", icon: "file-text", args: "status: overdue", result: "INV-0203: $2,400, 12 days\nINV-0207: $860, 4 days" }, { name: "draft_email", icon: "mail", args: "count: 2", result: "drafted: 2, held for review" }], say: "Two reminders are [drafted and held](https://mail.google.com/mail/#drafts). They go out when you say so." },
      { thought: "The forecast still uses August's collection rate. Reading September's before I update it.", tools: [{ name: "read_rate", icon: "activity", args: "month: Sep", result: "collected within 30 days: 91% (Aug 84%)" }, { name: "set_forecast", icon: "sliders-vertical", args: "rate: 0.91", result: "Q4 forecast: +$6,300" }], say: "September collects at 91%, up from 84%. [The Q4 forecast](https://docs.google.com/spreadsheets) moved up $6,300 on it." },
    ],
    asks: [{ question: "Two reminders are drafted for past-due invoices. Send them now?", options: [{ label: "Send both", note: "As drafted" }, { label: "Hold them", note: "Until Monday" }] }],
  },
  pipeline: {
    label: "Pipeline",
    updates: [["run", "Runs"], ["error", "Errors"], ["insight", "Insights"]],
    events: [ev("run", "Run finished: {n} pages in 1:40", "Catalog gained {n} routes", "Run finished: {n}{n} records, none dropped"), ev("error", "Timed out on {n} pages; retried once", "One route came back 429; waited it out")],
    hint: "A scraper, an API or a tool that runs on a schedule.",
    series: { label: "Requests", perDay: 2400 },
    tiles: [money("revenue", "Revenue"), num("pages", "Pages processed", 3, [4, 20]), num("errors", "Errors today", 0.001, [0, 1]), num("sites", "Sites walked", 0.002, [0, 1]), pct("success", "Success rate", 97.2, [-0.2, 0.2])],
    work: [
      { thought: "Walking a listing site with a 2-minute budget. Sampling every fourth page rather than reading all forty.", tools: [{ name: "crawl", icon: "search", args: "pages: 10, depth: 1", result: "fetched: 10\nwalled: 1 (Cloudflare)\nroutes found: 14" }], say: "Ten pages in 1:40, one walled. The fourteen XHR routes are in [the catalog](https://github.com/singularitystudiosdev)." },
      { thought: "One route returns the whole list as JSON. Calling that instead of the pages from now on.", tools: [{ name: "catalog_call", icon: "download", args: "route: [/api/listings?page=1](https://example.com/api/listings?page=1)", result: "200, 48 items, 12 KB" }], say: "The JSON route answers in one call what the pages took forty to give. Switched the job to it." },
      { thought: "The response shape changed: a field moved. Mapping the new field into the docs before the next poll breaks.", tools: [{ name: "read_schema", icon: "file-text", args: "endpoint: catalog, sample: 3", result: "price → priceInfo.price\nnew: priceInfo.currency" }, { name: "write_docs", icon: "check", args: "page: [catalog.md](https://github.com/singularitystudiosdev)", result: "updated 2 fields" }], say: "The price moved under priceInfo. [Docs](https://github.com/singularitystudiosdev) and the parser follow it now." },
      { thought: "A request came back 429. Waiting it out rather than retrying now, and reading the Retry-After.", tools: [{ name: "read_headers", icon: "activity", args: "last: 429", result: "retry-after: 30\nremaining: 0" }], say: "Thirty seconds, then the poll resumes. No retries in the meantime." },
    ],
    asks: [{ question: "The listing site walled the crawler. Rotate to a residential exit for this job?", options: [{ label: "Rotate the exit", note: "A few cents a page" }, { label: "Use the JSON route", note: "No browser needed" }] }],
  },
  research: {
    label: "Field study",
    updates: [["note", "Notes"], ["breakthrough", "Findings"], ["insight", "Insights"]],
    events: [ev("note", "Field note filed: week {n}", "{n} photos tagged by troop", "Note drafted: the count at the temple gate")],
    hint: "Observations, tags and the note they turn into.",
    series: { label: "Records tagged", perDay: 40 },
    tiles: [money("revenue", "Grant drawn"), num("tagged", "Tagged this month", 0.3, [1, 5]), num("notes", "Notes filed", 0.004, [0, 1]), num("photos", "Photos tagged", 0.05, [1, 4])],
    work: [
      { thought: "Tagging the morning's photos by troop. Two could be either; leaving them untagged rather than guessing.", tools: [{ name: "tag_photos", icon: "image", args: "batch: morning, count: 38", result: "temple troop: 21\ncliff troop: 15\nunsure: 2" }], say: "Thirty-six tagged, two held. The count at the temple gate is seven juveniles, one more than last week." },
      { thought: "The field note is due Friday. Drafting it from the week's tags, with the count that changed most first.", tools: [{ name: "read_week", icon: "file-text", args: "metric: juveniles, troops: 2", result: "temple: 7 (+1)\ncliff: 4 (0)" }, { name: "draft_note", icon: "check", args: "title: Week 37", result: "drafted, 3 paragraphs" }], say: "[Week 37 note](https://notion.so) is drafted around the extra juvenile at the temple. It is held for a look before it files." },
      { thought: "Scoring twelve sites on type and spacing. Capturing the three cleanest at phone width before I rank them.", tools: [{ name: "capture", icon: "image", args: "sites: 3, width: 390", result: "captured: 3" }, { name: "score", icon: "activity", args: "sites: 12", result: "top: 8.9, 8.4, 8.1\nmedian: 6.2" }], say: "The winners share one thing: one column and a lot of air. Writing that up as [the finding](https://figma.com)." },
      { thought: "Matching the sample against Google Fonts. It is a geometric sans, so I am narrowing to those first.", tools: [{ name: "search_fonts", icon: "search", args: "class: geometric sans, x-height: high", result: "- Outfit\n- Urbanist\n- Manrope" }], say: "Three candidates; [Manrope](https://fonts.google.com/specimen/Manrope)'s x-height is the closest. Keeping [Outfit](https://fonts.google.com/specimen/Outfit) as the runner-up in the note." },
    ],
    asks: [{ question: "Two photos could be either troop. File them as unsure, or drop them from the count?", options: [{ label: "File as unsure", note: "Counted separately" }, { label: "Drop them", note: "Out of the count" }] }],
  },
  newsletter: {
    label: "Newsletter",
    updates: [["send", "Sends"], ["subscriber", "Subscribers"], ["insight", "Insights"]],
    events: [ev("send", "Sent Tuesday's note to {n}k subscribers", "Thursday's note went out; {n}% opened in the first hour"), ev("subscriber", "{n} new subscribers today", "{name} and {n} others joined from the link")],
    hint: "A weekly note and the list that reads it.",
    series: { label: "Subscribers", perDay: 1200 },
    tiles: [money("revenue", "Revenue"), pct("opens", "Open rate", 46, [-0.4, 0.5]), num("sends", "Sends this month", 0.5, [0, 0]), num("newSubs", "New subscribers", 0.02, [0, 2]), pct("clicks", "Click rate", 8.1, [-0.2, 0.2])],
    work: [
      { thought: "The weekly note is due tomorrow. Pulling the three numbers that changed most, so the note says something.", tools: [{ name: "read_week", icon: "file-text", args: "metrics: opens, subs, revenue", result: "opens: +4 pts\nsubs: +212\nrevenue: +$1,140" }], say: "Drafted [the note](https://substack.com) around opens up four points. It is in the queue for a look before it goes out." },
      { thought: "Monday sends open better than Thursday ones for three weeks running. Reading the numbers before I move the slot.", tools: [{ name: "read_sends", icon: "mail", args: "by: weekday, weeks: 6", result: "Mon: 51%\nThu: 43%" }], say: "Monday opens at 51% against Thursday's 43%. [The next three notes](https://substack.com) go out Monday 9am." },
    ],
    asks: [{ question: "The note is ready. Send it now or schedule it for Monday 9am?", options: [{ label: "Schedule Monday", note: "The better slot" }, { label: "Send now", note: "Thursday, as usual" }] }],
  },
};

export const kindOf = (id) => KINDS[id] || KINDS.saas;

// the sidebar's one-line summary of what the tile carries
export const tileOf = (kind, id) => kindOf(kind).tiles.find((t) => t.id === id);

// the plan the agent drafts from a first message, before it asks for
// anything: six steps a kind, each a title and the detail under it, with
// {goal} standing for what was asked
const step = (title, detail) => ({ title, detail });
const PLANS = {
  channel: [
    step("Shape the channel around {goal}", "A name, an avatar, a banner and a one-line pitch that says who it is for; a trailer under a minute; the About page written for the search box."),
    step("Set the cadence", "One long video a week and three shorts cut from it, uploaded on the evening slot that does best; a two-week bank of scripts so a week never slips."),
    step("Make every video findable", "Titles written for the search box, three thumbnail variants tested per video, a pinned comment pointing at the next thing to watch."),
    step("Run the ads", "$20 a day on the best short, the budget moved to whatever wins each week, paused on any short under a 30% view rate."),
    step("Read the numbers every morning", "Watch time, thumbnail CTR and subscribers per video; one change at a time, kept only when it moves the graph."),
    step("Report every Monday", "A note here on what was posted, what it cost, what it earned and the one change for next week."),
  ],
  saas: [
    step("Ship the page and the checkout for {goal}", "One landing page that says what it does and for whom, a free tier and one paid plan, Stripe checkout live on day one."),
    step("Bring the first sign-ups in", "$30 a day of ads on the one line that converts, plus a founder post a week where the buyers already read."),
    step("Onboard every sign-up", "A three-step first run to the first win, a welcome note the same hour, a nudge on day three to whoever stalled."),
    step("Watch the funnel by day", "Visits, sign-ups, upgrades and churn; the biggest drop fixed first and nothing else touched until it moves."),
    step("Ship one improvement a week", "Taken from the support threads and the cancel reasons, released on Tuesday, announced in the weekly note."),
    step("Report every Monday", "MRR, new and lost customers, ad spend and what it bought, and the one change for next week."),
  ],
  outreach: [
    step("Find where the buyers for {goal} already talk", "The eight servers that fit, a week of reading before a first post, a note of who asks what."),
    step("Open with a question, not an offer", "Three openers tested per server; every reply answered the same day in the server's own tone."),
    step("Turn warm replies into calls", "A booking link in the second message and a plain one-page site to buy from, no deck."),
    step("Keep to each server's rules", "One DM a week at most, never a cold pitch in a public channel, a moderator's ask honoured at once."),
    step("Score the openers every week", "Replies, calls and sales per opener; every server switched to the winner on Monday."),
    step("Report every Monday", "Leads, calls booked, sales closed and the path each one took."),
  ],
  store: [
    step("Put {goal} in a store", "Three products with honest photos, one clear price each, shipping and returns spelled out on the product page."),
    step("Send traffic to the best product", "$20 a day of ads, the budget to whatever sells, stopped on any product under cost after a week."),
    step("Keep stock right", "Reorders from sell-through so nothing runs out or sits on a shelf; a low-stock line here before it bites."),
    step("Answer within the hour", "Every question and return handled in the store's own voice; refunds without a fight."),
    step("Grow the basket", "A bundle of the two products bought together and a thank-you note with a code for the second order."),
    step("Report every Monday", "Orders, revenue, ad spend, refunds and the one change for next week."),
  ],
  ops: [
    step("Connect the accounts behind {goal}", "Bank, Stripe and invoicing linked; every payout matched to an invoice and the odd ones flagged here."),
    step("Chase what is past due", "A reminder in the client's own tone, one a week, escalated after the third with a call for you to make."),
    step("Keep the books current", "Expenses tagged as they land, receipts filed, the month closed within three days of its end."),
    step("Forecast the month", "From the last three months and the open invoices, updated as they pay; the rate shown on the tile."),
    step("Cut what leaks", "Subscriptions nobody used in 60 days listed for a cancel; late fees and duplicate charges disputed."),
    step("Report every Monday", "Cash in, cash out, past due and the forecast, with one line on what changed."),
  ],
  pipeline: [
    step("Map the sources {goal} needs", "Each host, the shape it returns, its rate limits and what walls it; the plain JSON route preferred over the page."),
    step("Run the crawl on a schedule", "Retries on timeouts, never one host twice a second, a residential exit only when a wall needs it."),
    step("Catalog every route", "Path templates, sample bodies and status codes kept per host; the docs published from the catalog."),
    step("Validate the shape", "Every record checked against the last known shape before it goes downstream; a changed field stops the run."),
    step("Alert on drift", "A note here the moment a shape changes, a host blocks or a run misses its window."),
    step("Report every Monday", "Records fetched, failures by host, cost per thousand and what changed upstream."),
  ],
  research: [
    step("Set the question behind {goal}", "The two or three things to count, how each one is defined, and what would settle it."),
    step("Collect every morning", "Photos, notes and counts tagged as they land; the unsure ones kept apart, never dropped."),
    step("Keep the method fixed", "Same sites, same hours, same counting rule; a change to any of them written down on the day."),
    step("Write a field note a week", "From the counts, not from memory: what moved, what held, what was odd."),
    step("Check against the literature", "Each month the counts set beside what is published; a gap named rather than explained away."),
    step("Publish when the counts hold", "The tagged set and the note released once a month of counts holds steady."),
  ],
  newsletter: [
    step("Pick what {goal} readers come for", "Three things every issue delivers and a day it goes out; a name and a one-line promise on the landing page."),
    step("Write from the week", "What happened, one link that matters, one ask; drafted Thursday, sent Friday morning."),
    step("Grow the list", "A referral line at the foot of every issue, a landing page that says what the note is, a post a week where readers already are."),
    step("Keep the list clean", "Bounces removed, the quiet ones asked once whether to stay, never twice."),
    step("Read opens and clicks on Monday", "Subject lines tested two at a time; one change in the next note, no more."),
    step("Report every Monday", "Subscribers, opens, clicks and replies, and the one change for next week."),
  ],
};

export function planFor(kind, goal) {
  const short = (goal || "the project").trim().replace(/[.!?]+$/, "");
  const about = short.length > 60 ? `${short.slice(0, 57)}…` : short;
  const fill = (s) => s.replace("{goal}", about);
  return (PLANS[kind] || PLANS.saas).map((s) => ({ title: fill(s.title), detail: fill(s.detail) }));
}
