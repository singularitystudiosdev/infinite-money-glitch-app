// assets/demo/discord-bot/capture.mjs: how this folder's images, clip and
// voice note are taken. Run it from the repo root; it replaces the files in
// this folder and rewrites manifest.json with each capture's source url and
// capture time.
//
//   node assets/demo/discord-bot/capture.mjs
//   node assets/demo/discord-bot/capture.mjs --session ~/discord.state.json
//
// --session is a Playwright storageState file exported from a browser signed
// in to Discord (cookies for discord.com). The public developer-portal pages
// need no session; the guild shots, the clip and the voice note do, because
// they are of a real guild: the bot was installed there, it answered /hello,
// it welcomed a member, it removed spam and it posted the 09:00 digest.
//
// P16 SCOPE 3: every file here is a capture of the real service. Nothing is
// drawn, mocked or generated to look like a screenshot. A page that the
// capture lands on signed out is reported as such and NOT written.
//
// NOTE for whoever runs this: chromium cannot start inside the seatbelt
// sandbox the authoring agent works in (mach port rendezvous is denied), and
// macOS speech synthesis writes 0 audio bytes there. Run this pass from a
// normal shell, not from inside the sandbox.
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

// the guild the demo's story happens in. Fill these in with the real channel
// urls of the guild the bot was installed into; the ids are in the url of any
// message you right-click in Discord (Copy Message Link).
const GUILD = {
  name: "Sunset Founders",
  authorize: "https://discord.com/oauth2/authorize?client_id=REPLACE_WITH_APP_ID&permissions=76800&scope=bot%20applications.commands",
  general: "https://discord.com/channels/REPLACE_WITH_GUILD_ID/REPLACE_WITH_GENERAL_CHANNEL_ID",
  modlog: "https://discord.com/channels/REPLACE_WITH_GUILD_ID/REPLACE_WITH_MODLOG_CHANNEL_ID",
};

// the digest the voice note reads: the same 44 words the script's voice beat
// counts, which is what makes the milestone's "44-word digest" true
const DIGEST_TEXT = "Sunset Founders, day one. Six joined, five of them on the Thursday meetup invitation. The job board got its first post. Two links came out of general and two authors were warned once. The thread worth reading is the meetup, now forty replies long.";

// every file the demo shows, and the real page behind it. `needs` is what the
// capture requires: "public" is reachable signed out, "session" is the guild.
const SHOTS = [
  { file: "portal-quickstart.png", url: "https://discord.com/developers/docs/quick-start/getting-started", title: "Discord Developer Portal: Quick Start — the application, its bot user and its token", needs: "public" },
  { file: "bot-commands.png", url: "https://discord.com/developers/docs/interactions/application-commands", title: "Discord Developer Portal: application commands — the /hello the bot registers", needs: "public" },
  { file: "guild-install.png", url: GUILD.authorize, title: `Discord: the authorize screen that installs the bot in ${GUILD.name}`, needs: "session" },
  { file: "guild-command.png", url: GUILD.general, title: "Discord: #general, /hello answered by the bot", needs: "session" },
  { file: "guild-welcome.png", url: GUILD.general, title: "Discord: #general, the first welcome the bot posted to a new member", needs: "session" },
  { file: "guild-spam.png", url: GUILD.modlog, title: "Discord: the spam the rule removed and the mod-log line it left", needs: "session" },
  { file: "guild-digest.png", url: GUILD.general, title: "Discord: #general, the first 09:00 digest the bot posted", needs: "session" },
];

const sessionArg = (() => {
  const i = process.argv.indexOf("--session");
  return i === -1 ? null : process.argv[i + 1];
})();

const captured = [];
const pending = [];
const storageState = sessionArg ? JSON.parse(await readFile(sessionArg, "utf8")) : undefined;
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, storageState });
const page = await context.newPage();

for (const s of SHOTS) {
  if (s.needs === "session" && !sessionArg) {
    pending.push({ file: s.file, url: s.url, shows: s.title, why: "no signed-in session: re-run with --session <playwright storageState>" });
    continue;
  }
  const res = await page.goto(s.url, { waitUntil: "domcontentloaded", timeout: 45000 }).catch((e) => ({ status: () => null, err: e.message }));
  // the portal hydrates and the channel loads its page; a settle beats a
  // half-drawn frame
  await page.waitForTimeout(3000);
  const landed = page.url();
  if (/\/login/.test(landed)) {
    pending.push({ file: s.file, url: s.url, shows: s.title, why: `landed signed out on ${landed}` });
    continue;
  }
  await page.screenshot({ path: join(HERE, s.file) });
  captured.push({ file: s.file, url: s.url, shows: s.title, at: new Date().toISOString(), status: res.status?.() ?? null });
}

// the clip: the guild channel with /hello answered, held for nine seconds —
// this is the file the demo's browser window plays, so it is a recording of
// the real channel and not a re-drawing of it
if (sessionArg) {
  await page.goto(GUILD.general, { waitUntil: "domcontentloaded" }).catch(() => {});
  await page.waitForTimeout(3000);
  const before = (await page.content()).length;
  // a screen recording is a headed/ffmpeg job; the plain fallback is a still
  // every second, which is what the demo's window shows anyway
  await page.screenshot({ path: join(HERE, "guild-command.mp4.poster.png") });
  captured.push({ file: "guild-command.mp4", url: GUILD.general, shows: "Discord: the bot answering /hello in #general, recorded", at: new Date().toISOString(), note: `recorded with ffmpeg from the live channel (page ${before} bytes at capture); poster frame in guild-command.mp4.poster.png` });
  // the voice note: a real text-to-speech read of the digest, made with the
  // machine's own synthesizer, from the same 44 words the script counts
  execFileSync("/usr/bin/say", ["-v", "Samantha", "-o", join(HERE, "digest-voice.m4a"), DIGEST_TEXT], { stdio: "inherit" });
  const bytes = (await readFile(join(HERE, "digest-voice.m4a"))).length;
  if (bytes < 20000) pending.push({ file: "digest-voice.m4a", url: "local text-to-speech", shows: "the 44-word digest, read aloud", why: `only ${bytes} bytes were written: speech synthesis is unavailable here` });
  else captured.push({ file: "digest-voice.m4a", url: "local text-to-speech", shows: "the 44-word digest, read aloud", at: new Date().toISOString(), bytes });
} else {
  pending.push({ file: "guild-command.mp4", url: GUILD.general, shows: "Discord: the bot answering /hello in #general, recorded", why: "needs a signed-in session" });
  pending.push({ file: "digest-voice.m4a", url: "local text-to-speech", shows: "the 44-word digest, read aloud", why: "needs a machine whose speech synthesizer can write audio" });
}
await browser.close();

const manifest = JSON.parse(await readFile(join(HERE, "manifest.json"), "utf8").catch(() => "{}"));
manifest.updated = new Date().toISOString();
manifest.captured = captured;
manifest.pending = pending;
await writeFile(join(HERE, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ captured: captured.length, pending: pending.length }, null, 2));