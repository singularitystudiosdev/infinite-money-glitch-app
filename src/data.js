// data.js: the seed the app starts from, and the pools the simulation draws
// on. Everything a project says or finds comes from here, in the voice the
// frames use: what the assistant has in front of it, what it will do next.
import { KINDS } from "./kinds.js";

// every project has a kind (kinds.js): it decides what the right-hand
// column measures and what the agent does between asks
export const SEED_PROJECTS = [
  { id: "glitch", kind: "saas", name: "Infinite money glitch", revenue: 48210, baseline: 42890, adSpend: 6120, adSpendLast: 5400, thoughts: ["The revenue tile holds a live number, so I should read it instead of guessing", "Up 4% on the baseline; the checkout change is holding", "Sign-ups from mobile Safari halved on the 11th; reading the client errors", "Writing the weekly note from the live numbers, not last week's", "One insight is ready; queuing it for the panel", "Nothing new in the last hour, so I will hold the note until the morning"] },
  { id: "outreach", kind: "outreach", name: "Discord sales bot", revenue: 6840, thoughts: ["Three servers added the bot overnight; reading their intro channels first", "Forty replies since yesterday; sorting them by intent before I answer", "The question opener beat the offer opener two to one; switching every server", "One contact asked about the Notion export; quoting the plan page, not guessing", "A sale closed from Founder Coffee; logging the path it took", "A moderator asked for one DM a week; the bot follows it now"] },
  { id: "monkeys", kind: "channel", name: "Bali Bandit Monkeys", revenue: 12940, thoughts: ["Watch time says the temple video won last week; ranking the rest under it", "The top video has a clean 40 seconds at 2:10; cutting a short from it", "Tuesday at 6pm did best twice, so the short goes there", "Two comments ask for the location; answering both with the same line", "The thumbnail with the face beat the one without by a third", "Checking whether the sponsor's clip is cleared before I schedule it"] },
  { id: "chromatube", kind: "channel", name: "Chromatube", revenue: 9380, thoughts: ["The tunnel dropped at the reboot; checking it is back before anything else", "Health is green again, so I can render the new batch", "Rendering thumbnails for the new batch, three at a time", "Three videos need descriptions; writing them from the transcripts", "One upload failed on a timeout; retrying it once before I flag it", "Nothing waits on me for the next hour, so I am pruning the render cache"] },
  { id: "revops", kind: "ops", name: "Revenue Ops", revenue: 31650, thoughts: ["Stripe paid out $4,120; matching it against the open invoices", "Two invoices are past due; drafting the reminders in the client's tone", "The forecast still uses August's rate, so I am updating it for October", "One payout does not match any invoice; reading the memo before I guess", "The reminders are ready; asking before they go out", "Closing the week: every payout is matched"] },
  { id: "gallery", kind: "store", name: "Superbot ad gallery", revenue: 4420, thoughts: ["A new spot landed; rebuilding the manifest with it", "Checking every thumbnail loads on the live page before I call it shipped", "Click-through across the last five ads: the short one wins, reading why", "One thumbnail is a broken link; regenerating it from the source", "The gallery page is live and every asset answers 200", "Comparing the two headlines that ran this week"] },
  { id: "roblox", kind: "pipeline", name: "Roblox public API explorer", revenue: 2760, thoughts: ["Polling the catalog endpoint for new items", "The response shape changed; mapping the new field into the docs", "One request came back 429, so I am waiting it out rather than retrying now", "Twelve new items since the last poll; writing them up", "The docs say one thing and the response another; trusting the response", "Publishing the updated docs page"] },
  { id: "discord", kind: "pipeline", name: "Discord vector bot", revenue: 1880, thoughts: ["Embedding yesterday's messages, 340 of them", "Someone asked about the deploy script; reading it before I answer", "Two memories say the same thing; pruning the older one", "The answer is in the pinned message, so I am quoting that rather than guessing", "The index is 2% duplicates; cleaning it tonight", "Answered; watching the channel for a follow-up"] },
  { id: "primates", kind: "research", name: "Uluwatu primates", revenue: 3150, thoughts: ["Tagging the morning's photos by troop", "Counting the juveniles at the temple gate: seven, one more than last week", "The field note is due Friday; drafting it from the tags", "Two photos could be either troop; leaving them untagged rather than guessing", "The count is up, so I am flagging it in the note", "Uploading the tagged set to the shared album"] },
  { id: "scraper", kind: "pipeline", name: "Universal web scraper", revenue: 7210, thoughts: ["Walking a listing site with a 2-minute budget", "A page walled at Cloudflare; rotating the exit before I retry", "Cataloguing the XHR routes it found, 14 so far", "The listing has 40 pages; sampling every fourth rather than reading them all", "One route returns the whole list as JSON, so I am calling that instead of the pages", "Done in 1:40; writing the catalog"] },
  { id: "workouts", kind: "research", name: "Workout site sweep", revenue: 1290, thoughts: ["Scoring twelve sites on type and spacing", "Capturing the three cleanest at phone width", "The winners share one thing: one column and a lot of air. Writing that up", "Two sites tie; checking their contrast before I break it", "The sweep is done; ranking the twelve", "Sending the three captures to the gallery"] },
  { id: "fonts", kind: "research", name: "Font finder", revenue: 960, thoughts: ["Matching the sample against Google Fonts", "Two close pairings found; checking the x-height before I pick", "The sample is a geometric sans, so I am narrowing to those first", "One pairing clashes at small sizes; dropping it", "Writing the pairing recommendation with both candidates", "Recommendation sent; keeping the runner-up in the note"] },
  { id: "keys", kind: "pipeline", name: "Keyboard event logger", revenue: 540, setup: { done: ["youtube"], summary: { youtube: "Channel verified" }, current: 1, complete: false }, thoughts: ["Logging modifier combinations on macOS", "The dead-key path on a German layout is different; checking it", "Option plus a letter gives a different code than the docs say; trusting the log", "Publishing the demo page", "Two events fire for one key; keeping the first", "Watching for a report from the Windows tester"] },
];

// a few tiles start with something unread, one starts needing an answer
export const SEED_UNREAD = { glitch: 2, revops: 3, scraper: 1 };
export const SEED_NEEDS = { monkeys: 1 };

// the frame's own 14 days, kept exactly for the first project
export const GLITCH_USERS = [812, 845, 830, 902, 960, 940, 1005, 1120, 1080, 1150, 1240, 1190, 1310, 1385];

export const NEW_THOUGHTS = ["Nothing to do yet; reading the brief when it lands", "Setting up the workspace and a first task", "Waiting for a first message before I plan anything", "Looking at what the other projects share that I can reuse"];

// what a project stops to ask; the question goes to the bell, the tile
// only wears the orange count
export const QUESTIONS = ["Approve the new thumbnail?", "Which title should go out?", "OK to spend $40 more on ads today?", "Renew the API key before it expires?", "Reply to the sponsor's email?", "Ship the draft or hold it for review?"];

export const INSIGHT_TYPES = {
  breakthrough: { label: "Breakthrough", icon: "zap" },
  discovery: { label: "Discovery", icon: "compass" },
  anomaly: { label: "Anomaly", icon: "activity" },
};

const H = 3600000;
const D = 24 * H;

export const GLITCH_INSIGHTS = [
  { type: "breakthrough", title: "Checkout conversion crossed 4% for the first time", why: "The one-page checkout shipped on Sep 9; every day since sits above the old ceiling.", delta: 38, ago: 2 * H },
  { type: "discovery", title: "Returning users read the pricing page twice before buying", why: "Second visits to pricing convert at three times the first; the page is doing the selling.", delta: 12, ago: D + 3 * H },
  { type: "anomaly", title: "Sign-ups from mobile Safari halved on Sep 11", why: "Desktop was flat the same day, so this is a client issue, not demand.", delta: -51, ago: 2 * D + 5 * H },
  { type: "breakthrough", title: "Active users up 70% in two weeks", why: "Growth compounds day over day instead of spiking on one campaign.", delta: 71, ago: 3 * D },
  { type: "discovery", title: "Invoices uploaded on Mondays are paid two days sooner", why: "Finance teams batch on Monday mornings; that is the send window.", delta: 18, ago: 5 * D },
  { type: "anomaly", title: "Notification opens spiked at 3 a.m. UTC", why: "One account fired 400 events in a minute; an automation, not people.", delta: 320, ago: 7 * D },
];

// what arrives on its own, in order, then around again
export const INSIGHT_POOL = [
  { type: "discovery", title: "Dictated prompts run 40% longer than typed ones", why: "Voice users say more and edit less; the mic is a drafting tool.", delta: 40 },
  { type: "breakthrough", title: "Median time to first sale fell under a day", why: "Onboarding now lands on the plus button; new workspaces sell on day one.", delta: 22 },
  { type: "anomaly", title: "One invoice was counted twice", why: "A retry landed the same upload again; the total corrected itself on the next reset.", delta: -3 },
  { type: "discovery", title: "Opus 5 is picked for 61% of long prompts", why: "Past 400 characters the model chip flips; short asks stay on Sonnet.", delta: 61 },
  { type: "breakthrough", title: "Notifications are read within a minute, nine times in ten", why: "The bell's unread count is doing its job; nothing sits unseen.", delta: 27 },
  { type: "discovery", title: "Shorts under 40 seconds keep twice the viewers", why: "Retention falls off a cliff at the 40-second mark; the cut lands before it.", delta: 48 },
  { type: "anomaly", title: "Ad spend doubled on Sunday with no extra sales", why: "A bid cap was lifted by the platform's default; it is back in place.", delta: -34 },
  { type: "breakthrough", title: "The Tuesday slot beat every other upload time", why: "Three Tuesdays in a row took the top spot; the schedule follows it.", delta: 19 },
];

// missions carry the kinds they make sense for; a project draws its own
export const MISSION_POOL = [
  { id: "video", kinds: ["channel"], title: "End to end video creation", site: "Runway", url: "https://runwayml.com", icon: "clapperboard", progress: 62, steps: ["Writing the script from the top insight", "Generating scene 3 of 5 on Runway", "Cutting the scenes to the voice track", "Rendering the 1080p export", "Uploading to the channel as unlisted"] },
  { id: "thumbs", kinds: ["channel"], title: "Thumbnail variants for the launch video", site: "Ideogram", url: "https://ideogram.ai", icon: "image", progress: 28, steps: ["Pulling the three strongest frames", "Generating six title treatments on Ideogram", "Scoring each against last month's winners", "Queuing the top two for an A/B test"] },
  { id: "schedule", kinds: ["channel"], title: "Weekly upload schedule", site: "YouTube Studio", url: "https://studio.youtube.com", icon: "calendar-clock", progress: 85, steps: ["Reading the last 30 days of watch time by hour", "Placing the Tuesday and Friday slots", "Writing the descriptions and tags", "Scheduling the two uploads"] },
  { id: "ads", kinds: ["saas", "store"], title: "Retargeting campaign for the pricing page", site: "Google Ads", url: "https://ads.google.com", icon: "zap", progress: 14, steps: ["Pulling the last 30 days of pricing-page visitors", "Writing three headlines from the top discovery", "Setting the daily cap to the card's limit", "Launching and watching the first hour"] },
  { id: "safari", kinds: ["saas"], title: "Fix the mobile Safari sign-up bug", site: "GitHub", url: "https://github.com", icon: "shield-check", progress: 38, steps: ["Reading the 208 TypeErrors since Sep 11", "Reproducing on iOS 18 Safari", "Patching signup.js and adding the test", "Shipping behind the flag and watching sign-ups"] },
  { id: "payouts", kinds: ["ops", "store"], title: "Reconciling this month's payouts", site: "Stripe", url: "https://dashboard.stripe.com", icon: "receipt", progress: 46, steps: ["Reading the payout list", "Matching each payout to an invoice", "Flagging the one that does not match", "Writing the note for finance"] },
  { id: "reminders", kinds: ["ops"], title: "Past-due reminders in the client's tone", site: "Gmail", url: "https://mail.google.com", icon: "mail", progress: 70, steps: ["Reading the last thread with each client", "Drafting both reminders", "Holding them for a look", "Sending and logging the replies"] },
  { id: "newsletter", kinds: ["newsletter", "saas"], title: "Weekly note to subscribers", site: "Substack", url: "https://substack.com", icon: "mail", progress: 71, steps: ["Reading the week's insights", "Drafting the three-paragraph note", "Picking the chart to embed", "Scheduling for Friday 9am"] },
  { id: "servers", kinds: ["outreach"], title: "Warm the three new servers", site: "Discord", url: "https://discord.com", icon: "inbox", progress: 34, steps: ["Reading each server's intro and rules channels", "Writing a first line that fits each one", "Sending the opener to the first 50 in each", "Sorting the replies by intent"] },
  { id: "opener", kinds: ["outreach"], title: "Opener A/B test across eleven servers", site: "Discord", url: "https://discord.com", icon: "compass", progress: 88, steps: ["Splitting the send list in two", "Sending 600 of each opener", "Reading reply rates at 24 hours", "Switching every server to the winner"] },
  { id: "closing", kinds: ["outreach"], title: "Close the fourteen warm replies", site: "Stripe", url: "https://dashboard.stripe.com", icon: "receipt", progress: 21, steps: ["Sending the demo link to each", "Answering the nineteen questions one by one", "Sending checkout links to the ones who ask", "Logging each sale and the path it took"] },
  { id: "catalog", kinds: ["pipeline"], title: "Catalog the listing site's backend", site: "Scraper", url: "https://example.com", icon: "search", progress: 55, steps: ["Walking ten pages within the budget", "Recording every XHR route", "Finding the JSON route that returns the list", "Switching the job to the JSON route"] },
  { id: "docs", kinds: ["pipeline"], title: "Publish the updated API docs", site: "GitHub Pages", url: "https://pages.github.com", icon: "file-text", progress: 76, steps: ["Mapping the moved field into the docs", "Regenerating the examples", "Checking every link", "Publishing the page"] },
  { id: "fieldnote", kinds: ["research"], title: "Week 37 field note", site: "Notion", url: "https://notion.so", icon: "file-text", progress: 48, steps: ["Tagging the week's photos by troop", "Counting juveniles at each site", "Drafting the three-paragraph note", "Filing it with the tagged set"] },
  { id: "sweep", kinds: ["research"], title: "Rank the twelve sites", site: "Figma", url: "https://figma.com", icon: "image", progress: 64, steps: ["Scoring type and spacing on each", "Capturing the top three at phone width", "Writing the finding", "Sending the captures to the gallery"] },
  { id: "restock", kinds: ["store"], title: "Reorder the blue variant", site: "Shopify", url: "https://shopify.com", icon: "inbox", progress: 18, steps: ["Reading the sell-through by variant", "Sizing the order to 30 days", "Placing the order with the supplier", "Setting the low-stock alert"] },
];

// the short jobs a subagent takes on and finishes in a minute or two, per
// kind, with a few every kind shares. A manager's missions are above.
export const QUICK_POOL = {
  channel: ["Render thumbnail B", "Reply to three comments", "Trim the intro to 20s", "Write the description", "Tag the new upload", "Pin the top comment", "Resample the audio track", "Schedule the Friday upload"],
  saas: ["Reproduce the Safari bug", "Draft the pricing follow-up", "Read today's sign-ups", "Rotate the API key", "Update the changelog", "Check the checkout funnel", "Answer the billing ticket"],
  outreach: ["Open three warm threads", "Log the new replies", "Score the opener variants", "Send the follow-up batch", "Update the CRM notes", "Close the two ready deals"],
  store: ["Reorder the blue variant", "Answer the return request", "Check the ad spend cap", "Photograph the new stock", "Update the size guide"],
  ops: ["Match payout po_8812", "Send the past-due reminder", "File the July invoice", "Reconcile the card fees", "Update the forecast rate"],
  pipeline: ["Walk the listing site", "Catalog the new routes", "Retry the timed-out page", "Prune the render cache", "Publish the docs page"],
  research: ["Tag the morning's photos", "Count the temple troop", "File the field note draft", "Upload the tagged set"],
  newsletter: ["Draft Tuesday's note", "Clean the bounce list", "Pick the top three links", "Schedule the send"],
  common: ["Read the last hour of the log", "Clear the queue of retries", "Write the daily summary", "Check the credit balance"],
};

// one unread row to start, the rest already read
export const SEED_NOTIFICATIONS = [
  { kind: "needs", text: "Bali Bandit Monkeys needs you: Approve the new thumbnail?", projectId: "monkeys", ago: 6 * 60000, read: false },
  { kind: "upload", text: "Mission done: Weekly upload schedule", projectId: "monkeys", ago: D + 2 * H, read: true },
  { kind: "system", text: "2,500 credits added", ago: 2 * D, read: true },
];

export const SEED_INVOICES = [
  { id: "INV-0031", ago: 2 * D, amount: 20, desc: "2,500 credits", status: "Paid" },
  { id: "INV-0027", ago: 16 * D, amount: 70, desc: "10,000 credits", status: "Paid" },
  { id: "INV-0022", ago: 41 * D, amount: 20, desc: "2,500 credits", status: "Paid" },
  { id: "INV-0018", ago: 63 * D, amount: 5, desc: "500 credits", status: "Refunded" },
];

// what any agent does when nothing kind-specific is waiting: the work and
// the questions every kind falls back on
export const WORK_COMMON = [
  { thought: "Nothing is waiting on me. Using the gap to clean the tag list, which has grown three near-duplicates.", tools: [{ name: "list_tags", icon: "sliders-vertical", args: "similar: true", result: "\"bali travel\" / \"Bali Travel\" / \"bali-travel\"\n\"monkeys\" / \"monkey\"" }, { name: "merge_tags", icon: "check", args: "groups: 2", result: "merged: 5 into 2" }], say: "[Merged five tags](https://notion.so) into two. Everything keeps its tags, just spelled one way now." },
  { thought: "The weekly summary is due tomorrow. Pulling the three numbers that changed most, so the note says something.", tools: [{ name: "read_week", icon: "file-text", args: "metrics: top 3 by change", result: "revenue: +$1,140\nreach: +18%\nasks answered: 6" }], say: "Drafted [the summary](https://docs.google.com/document) around revenue up $1,140. It is in [the queue](https://notion.so) for a look before it goes out." },
];

export const ASKS_COMMON = [{ question: "The weekly summary is drafted. Send it tonight or hold it for the morning?", options: [{ label: "Send tonight", note: "As drafted" }, { label: "Hold for the morning", note: "One more look first" }] }];

// one flat rate, 10,000 credits a dollar, whatever the pack; the Other row
// prices at the same rate (store.CREDITS_PER_DOLLAR reads it off the first)
export const CREDIT_PACKS = [
  { id: "small", credits: 50000, price: 5 },
  { id: "mid", credits: 200000, price: 20, note: "Most picked" },
  { id: "large", credits: 700000, price: 70 },
];
export const CREDITS_LOW = 1000;

export const MODELS = [
  { name: "Sonnet 5", note: "Balanced", ctx: "200k" },
  { name: "Opus 5", note: "Deepest", ctx: "200k" },
  { name: "Haiku 4.5", note: "Fastest", ctx: "200k" },
  { name: "Fable 5.1", note: "Most creative", ctx: "1M" },
  { name: "Uncensored", note: "No refusals (gateway)", ctx: "gateway" },
];

// the kinds a new project can start as, in the order the dialog offers them
export const TEMPLATES = ["outreach", "channel", "store", "saas", "newsletter", "pipeline"].map((id) => ({ id, label: KINDS[id].label, hint: KINDS[id].hint }));
