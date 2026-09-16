// record.mjs — records the demo run (#/p/new-project-hlug) end to end as a
// video, rendered deterministically: the browser's clock is frozen and
// advanced exactly one frame at a time (Chrome's virtual time, the way
// timecut and film renderers work), each frame is captured as a lossless
// PNG and piped into a fixed 60 fps H.264 encode. No frame can be dropped
// and no compression happens twice, so the result is smooth and clean at
// any machine speed. The page is painted the brand green before the app
// boots (no grey flash, no crossfade ahead of the opening line), and it is
// told it is being recorded (window.__demoRecording) so the record button
// never appears in its own video; the outro's Replay is hidden the same way.
// The demo's own clip cannot follow a frozen clock on its own, so the
// recorder drives it: playback is held and the playhead is set from the
// virtual clock before every frame.
// usage: node record.mjs --url <demo url> --out <dir> [--width 1440 --height 900 --fps 60 --limit <seconds>]
// stdout: one JSON line per phase ({ phase }), then { done, file, seconds }
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import { appendFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => (a.startsWith("--") ? [a.slice(2), all[i + 1]] : [])).filter((x) => x.length));
const url = args.url;
const out = args.out;
if (!url || !out) {
  console.error("usage: node record.mjs --url <url> --out <dir>");
  process.exit(2);
}
const size = { width: Number(args.width) || 1440, height: Number(args.height) || 900 };
const FPS = Number(args.fps) || 60;
const FRAME_MS = 1000 / FPS;
// a cap on the run, for a quick check of the pipeline (--limit 10) and as
// a guard against a run that never reaches its sign-off
const LIMIT_S = Number(args.limit) || 300;
// the sign-off holds for this long before the recording ends
const TAIL_S = 1.5;
// a seeked video frame has to be decoded and presented, and a frozen clock
// cannot give a decoder the time to do it: while a clip is on the page its
// frames are paid for in real milliseconds
const SEEK_SETTLE_MS = Number(args.settle) || 45;
// the brand green in demo.css (--demo-brand)
const BRAND = "#6e967e";
// every phase goes to stdout for the server that spawned this, and to a log
// beside the recording so a run can be followed while it is still going
const say = (o) => {
  console.log(JSON.stringify(o));
  try { appendFileSync(join(out, "progress.log"), `${new Date().toISOString()} ${JSON.stringify(o)}\n`); } catch { /* the directory is made a moment later */ }
};

await mkdir(out, { recursive: true });
say({ phase: "opening the browser" });
// the installed Chrome plays the demo's H.264 clip; the bundled Chromium
// stands in when there is none (the clip would then be a black frame)
const launch = { headless: true, args: ["--autoplay-policy=no-user-gesture-required"] };
const browser = await chromium.launch({ ...launch, channel: "chrome" }).catch(() => chromium.launch(launch));
const context = await browser.newContext({ viewport: size, deviceScaleFactor: 1, reducedMotion: "no-preference" });
await context.addInitScript((brand) => {
  window.__demoRecording = true;
  const add = (id, css) => {
    const s = document.createElement("style");
    s.id = id;
    s.textContent = css;
    document.documentElement.append(s);
    return s;
  };
  const install = () => {
    if (!document.documentElement) return false;
    // the page is the brand green until the demo paints its own, and the
    // chrome the intro hides (the rails, the head) is gone from the first
    // frame instead of easing out over 600 ms. The lead style goes once
    // the intro's first frame has been drawn, so the demo's own fades
    // (the 1 s background, the rails coming back) run from where they end
    const lead = add("demo-rec-lead", `body{background:${brand}!important;transition:none!important}.app-project__side,.app-chat__head,.app-project__rail{transition:none!important}`);
    add("demo-rec-hide", ".demo-outro__replay,.demo-record{display:none!important}");
    new MutationObserver((_, o) => {
      if (!document.body?.classList.contains("is-demo-intro")) return;
      o.disconnect();
      requestAnimationFrame(() => requestAnimationFrame(() => lead.remove()));
    }).observe(document.documentElement, { attributes: true, subtree: true, attributeFilter: ["class"] });
    return true;
  };
  if (!install()) new MutationObserver((_, o) => install() && o.disconnect()).observe(document, { childList: true });

  // the demo's clip under a frozen clock: play() does not start real
  // playback, it notes the virtual moment the clip began; the recorder
  // then sets the playhead from that before every frame. The element
  // reports itself as playing so the demo's own timing (leave 0.1 s before
  // the end) reads the playhead as it would in a live run
  window.__recVideos = [];
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    if (!this.__recStart) {
      this.__recStart = performance.now();
      this.autoplay = false;
      Object.defineProperty(this, "paused", { get: () => this.__recEnded !== true && false, configurable: true });
      window.__recVideos.push(this);
    }
    return Promise.resolve();
  };
  // an autoplay attribute would start real playback without play(): strip
  // it the moment a video lands in the page, then take it over. The watch
  // is on the document itself, which exists before its root element does
  new MutationObserver((muts) => {
    for (const m of muts) for (const n of m.addedNodes) {
      const vids = n.nodeType === 1 ? (n.matches?.("video") ? [n] : [...(n.querySelectorAll?.("video") ?? [])]) : [];
      for (const v of vids) { v.autoplay = false; v.removeAttribute("autoplay"); if (!v.__recStart) v.play(); }
    }
  }).observe(document, { childList: true, subtree: true });
}, BRAND);

const page = await context.newPage();
const cdp = await context.newCDPSession(page);
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

// the clock: frozen from before the first byte, then granted one frame of
// time per step. Pending network fetches hold the clock, so the app's
// scripts, styles and the clip all load in full before time moves
await cdp.send("Emulation.setVirtualTimePolicy", { policy: "pause" });
say({ phase: "loading the demo" });
await page.goto(url, { waitUntil: "commit" });

// one frame of virtual time, then the page as it stands
// Time advances whatever the network is doing. Holding the clock for
// pending fetches sounds right and is a trap: the demo's clip keeps a media
// request open for as long as it is on the page, so the budget would never
// expire and the recording would hang forever. The clip is driven by its
// playhead below, not by its download, so it does not need the clock's help
async function step() {
  const expired = new Promise((resolve) => cdp.once("Emulation.virtualTimeBudgetExpired", resolve));
  await cdp.send("Emulation.setVirtualTimePolicy", { policy: "advance", budget: FRAME_MS, maxVirtualTimeTaskStarvationCount: 100000 });
  // a budget that never reports back must not be able to stop the run
  await Promise.race([expired, new Promise((r) => setTimeout(r, 2000))]);
}
// the demo's clip: playhead from the virtual clock, seek finished before
// the frame is taken
// Nothing is awaited inside the page. A wait there deadlocks the whole
// recording: the timer that would end it is itself on the frozen clock, and
// the clock only moves when this script grants it a frame, which it cannot
// do while it is waiting. The seek settles during the frame of virtual time
// granted immediately after, before the screenshot is taken
const driveVideos = () =>
  page.evaluate(() => {
    let active = 0;
    for (const v of window.__recVideos || []) {
      if (!v.isConnected || v.__recEnded) continue;
      // a clip still waiting for its metadata counts as active too, so the
      // loop below grants it real time to load rather than filming a hole
      active++;
      const d = Number.isFinite(v.duration) ? v.duration : null;
      if (d === null) continue;
      const t = (performance.now() - v.__recStart) / 1000;
      const target = Math.min(t, d);
      if (Math.abs(v.currentTime - target) >= 0.004) v.currentTime = target;
      if (t >= d) v.__recEnded = true;
    }
    return active;
  });
const shot = async () => Buffer.from((await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true })).data, "base64");
const started = () => page.evaluate(() => !!document.body?.classList.contains("is-demo-intro"));
const signedOff = () => page.evaluate(() => !!document.querySelector(".demo-outro__replay.is-in"));

// frames go straight into the encoder as they are taken
const mp4 = join(out, "demo.mp4");
// the frames as captured; the clip is laid over them in a second pass
const framesMp4 = join(out, "frames.mp4");
const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "14", "-pix_fmt", "yuv420p", "-movflags", "+faststart", framesMp4], { stdio: ["pipe", "inherit", "inherit"] });
const ffDone = new Promise((resolve) => {
  ff.on("error", (err) => { console.error(`ffmpeg: ${err.message}`); resolve(false); });
  ff.on("exit", (code) => resolve(code === 0));
});
const write = (buf) => new Promise((resolve) => (ff.stdin.write(buf) ? resolve() : ff.stdin.once("drain", resolve)));

// the lead, until the demo takes the page: time moves, nothing is kept
let lead = 0;
while (!(await started())) {
  await step();
  if (++lead > FPS * 30) { console.error("the demo never started"); process.exit(1); }
}
say({ phase: "recording the run" });
let frames = 0;
let tail = null;
// where and when the demo's clip is on screen. A seeked video does not
// repaint under a frozen clock, so the page's own copy of it is a still:
// the real clip is laid back over these frames afterwards, at its own rate
let clip = null;
for (;;) {
  // the clip's playhead, then a frame of virtual time for that seek and the
  // page's own work to land, then the frame itself. The race is a guard in
  // real time: nothing inside the page may be able to stop the run
  const playing = await Promise.race([driveVideos(), new Promise((r) => setTimeout(r, 1000, 0))]);
  await step();
  // the decoder gets its real milliseconds only while a clip is on screen,
  // so the rest of the run keeps running at the speed of the screenshots
  if (playing) {
    await new Promise((r) => setTimeout(r, SEEK_SETTLE_MS));
    // measured after the frame of virtual time, so the window has finished
    // sliding and the box is the one the clip is actually drawn in
    const box = await page.evaluate(() => {
      const v = (window.__recVideos || []).find((x) => x.isConnected);
      if (!v) return null;
      const r = v.getBoundingClientRect();
      return { src: v.currentSrc, duration: v.duration, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    });
    if (box?.w > 0) clip = clip ? { ...clip, ...box, to: frames } : { ...box, from: frames, to: frames };
  }
  await write(await shot());
  frames++;
  if (frames % (FPS * 5) === 0) say({ phase: `recording the run (${Math.round(frames / FPS)} s)` });
  if (tail === null && (await signedOff())) tail = frames + Math.round(TAIL_S * FPS);
  if (tail !== null && frames >= tail) break;
  if (frames >= LIMIT_S * FPS) break;
}
ff.stdin.end();
await context.close();
await browser.close();
if (errors.length) console.error(`page errors: ${errors.join(" | ")}`);

say({ phase: "encoding" });
const ok = await ffDone;
if (!ok) {
  console.error("ffmpeg failed");
  process.exit(1);
}

// The clip goes back on at its own frame rate. The page's copy of it is a
// still: a seeked video does not repaint under a frozen clock, so the box
// it occupied and the frames it occupied were noted while recording, and
// the real file is laid over exactly that rectangle for exactly that span
if (clip) {
  say({ phase: "laying the clip back in" });
  const here = dirname(fileURLToPath(import.meta.url));
  const source = join(here, new URL(clip.src).pathname);
  const at = (clip.from / FPS).toFixed(3);
  const until = ((clip.to + 1) / FPS).toFixed(3);
  const laid = await new Promise((resolve) => {
    const over = spawn("ffmpeg", ["-y", "-loglevel", "error", "-i", framesMp4, "-i", source,
      "-filter_complex", `[1:v]scale=${clip.w}:${clip.h},setpts=PTS-STARTPTS+${at}/TB[c];[0:v][c]overlay=${clip.x}:${clip.y}:enable='between(t,${at},${until})'`,
      "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-r", String(FPS), "-an", mp4], { stdio: ["ignore", "inherit", "inherit"] });
    over.on("error", (err) => { console.error(`ffmpeg overlay: ${err.message}`); resolve(false); });
    over.on("exit", (code) => resolve(code === 0));
  });
  if (laid) await rm(framesMp4, { force: true });
  else {
    console.error("the clip could not be laid back in; the page's own frames are the recording");
    await rename(framesMp4, mp4);
  }
} else await rename(framesMp4, mp4);

const seconds = frames / FPS;
const bytes = (await stat(mp4)).size;
say({ done: true, file: mp4, seconds, bytes, frames, fps: FPS, clip, errors: errors.length });
