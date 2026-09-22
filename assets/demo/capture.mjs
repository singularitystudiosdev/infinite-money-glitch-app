// assets/demo/capture.mjs — the demo capture tool (P16 SCOPE 3).
//
// One demo's screenshots, taken from the services themselves. Reads the
// demo's own manifest.json, drives a HEADLESS browser to each entry's source
// url, and writes the image beside the manifest with the instant it was
// taken stamped into the entry. Nothing is drawn, mocked or synthesized: if
// a page cannot be reached the shot stays missing and the manifest records
// why, so a demo never silently ships with a placeholder where a real
// capture was supposed to be (prompts/daemon-agent-prompt-series.md P16
// G3: "0 synthetic images").
//
// usage: node assets/demo/capture.mjs <demo-id> [--only <file>] [--dry-run]
//        node assets/demo/capture.mjs --all
// stdout: one JSON line per shot, then a summary { ok, shots, skipped, blocked }.
//
// The browser is a dedicated headless context with its own profile: it never
// touches a window anyone is using (headless-e2e).
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
// a capture already on disk is never overwritten unless --force: a good shot
// taken earlier must not be replaced by whatever the page serves today
const force = args.includes("--force");
const all = args.includes("--all");
const targets = all ? null : args.filter((a) => !a.startsWith("--") && a !== only);
const demoIds = all ? (await readdir(HERE, { withFileTypes: true })).filter((e) => e.isDirectory() && chunkManifest(e.name)).map((e) => e.name) : targets.filter((t) => t && t !== "capture" && t !== "bears-shared");

function chunkManifest(name) {
  return existsSync(join(HERE, name, "manifest.json"));
}

// a url the tool is willing to open. Only http(s): a manifest that points at
// a local file or a directory is a statement about files that exist on disk,
// not something to browse to.
const browsable = (url) => /^https?:\/\//i.test(String(url || ""));

const say = (o) => console.log(JSON.stringify(o));

async function captureDemo(id, browser) {
  const dir = join(HERE, id);
  const manifestPath = join(dir, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const shots = Array.isArray(manifest.screenshots) ? manifest.screenshots : [];
  const out = { id, taken: [], skipped: [], blocked: [] };
  await mkdir(dir, { recursive: true });
  for (const shot of shots) {
    if (only && shot.file !== only) continue;
    if (!browsable(shot.url)) {
      out.skipped.push({ file: shot.file, why: shot.url ? "not an http(s) source" : "no source url" });
      say({ shot: shot.file, status: "skipped", why: out.skipped.at(-1).why });
      continue;
    }
    if (dryRun) {
      say({ shot: shot.file, status: "would-capture", url: shot.url });
      continue;
    }
    if (!force && existsSync(join(dir, shot.file))) {
      out.taken.push({ file: shot.file, url: shot.url, kept: true });
      say({ shot: shot.file, status: "kept", why: "already on disk" });
      continue;
    }
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
    const page = await context.newPage();
    try {
      const res = await page.goto(shot.url, { waitUntil: "domcontentloaded", timeout: 45000 });
      // a wall is an answer: a login page, a consent interstitial or a bot
      // gate means this shot has no real capture, and the manifest says so
      await page.waitForTimeout(2500);
      const wall = await page.evaluate(() => {
        const text = (document.body?.innerText || "").trim();
        const hasPassword = Boolean(document.querySelector('input[type="password"]'));
        const content = document.querySelector("main, article, [role=main]");
        const contentLen = content ? (content.innerText || "").trim().length : 0;
        // a wall is a LOGIN FORM or an empty shell, not merely a page that
        // mentions signing in somewhere in its own furniture: a public
        // channel page carries a "Sign in" button in its masthead and is
        // still a real capture
        const login = hasPassword && contentLen < 400;
        const shell = text.length < 300 && !content;
        return { login, shell, title: document.title, textLen: text.length };
      });
      await page.screenshot({ path: join(dir, shot.file), fullPage: false });
      const status = res?.status() ?? 0;
      const entry = { file: shot.file, url: shot.url, title: shot.title || "", capturedAt: new Date().toISOString(), httpStatus: status, wall: wall.login ? "sign-in wall" : wall.shell ? "empty body" : null };
      if (entry.wall || status >= 400) {
        // the file is kept: it is evidence of what the service answered
        out.blocked.push(entry);
        say({ shot: shot.file, status: "blocked", why: entry.wall || `http ${status}` });
      } else {
        shot.capturedAt = entry.capturedAt;
        shot.httpStatus = status;
        out.taken.push(entry);
        say({ shot: shot.file, status: "captured", url: shot.url });
      }
    } catch (err) {
      out.blocked.push({ file: shot.file, url: shot.url, why: String(err?.message || err).slice(0, 200) });
      say({ shot: shot.file, status: "blocked", why: String(err?.message || err).slice(0, 160) });
    } finally {
      await context.close().catch(() => {});
    }
  }
  if (!dryRun) {
    manifest.capture = { tool: "assets/demo/capture.mjs", capturedAt: new Date().toISOString(), captured: out.taken.map((t) => t.file), blocked: out.blocked.map((b) => ({ file: b.file, why: b.why || b.wall })), skipped: out.skipped };
    // the inventory of what is actually in this folder, relative to it. run.js
    // reads this so a demo requests only media that exists: a shot still owed
    // is never asked for, and the demo stops 404ing its own host
    const walk = async (rel = "") => {
      const here = join(dir, rel);
      const names = await readdir(here).catch(() => []);
      const out2 = [];
      for (const name of names) {
        const child = rel ? `${rel}/${name}` : name;
        const full = join(dir, child);
        const st = await stat(full).catch(() => null);
        if (!st) continue;
        if (st.isDirectory()) out2.push(...(await walk(child)));
        else if (/\.(png|jpe?g|webp|gif|mp4|webm|m4a|wav|mp3)$/i.test(name)) out2.push(child);
      }
      return out2;
    };
    manifest.files = await walk();
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  }
  return out;
}

const ids = (demoIds || []).filter(Boolean);
if (!ids.length) {
  console.error("usage: node assets/demo/capture.mjs <demo-id>... | --all [--dry-run] [--only <file>]");
  process.exit(2);
}

const browser = await chromium.launch({ headless: true }).catch((err) => {
  console.error(`headless browser unavailable: ${err.message}`);
  process.exit(3);
});
const results = [];
for (const id of ids) {
  try {
    results.push(await captureDemo(id, browser));
  } catch (err) {
    results.push({ id, error: String(err?.message || err) });
    say({ demo: id, status: "error", why: String(err?.message || err).slice(0, 200) });
  }
}
await browser.close();

const totals = results.reduce((a, r) => ({ ok: a.ok + (r.taken?.length || 0), blocked: a.blocked + (r.blocked?.length || 0), skipped: a.skipped + (r.skipped?.length || 0) }), { ok: 0, blocked: 0, skipped: 0 });
say({ done: true, demos: ids.length, ...totals, results: results.map((r) => ({ id: r.id, taken: r.taken?.length || 0, blocked: r.blocked?.length || 0, skipped: r.skipped?.length || 0, error: r.error })) });
process.exit(totals.ok > 0 ? 0 : 1);