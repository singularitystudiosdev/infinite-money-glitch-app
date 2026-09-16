// serve.mjs — static file server for the frontend. The mission backend is
// gone; the app boots standalone on the client-side sim (src/sim.js) and
// probes /health only to decide whether a live backend exists, so a plain
// static server is all the frontend needs. Run: node serve.mjs (IMG_PORT
// overrides the port, default 8491). The one dynamic route is the demo
// recorder: POST /api/demo/record plays the demo in a headless browser
// (record.mjs) and GET /api/demo/record/<id> reads the job back.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { basename, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// fileURLToPath, not .pathname: a folder with a space in its name would
// otherwise be read as %20 and every file would 404
const ROOT = fileURLToPath(new URL(".", import.meta.url));
const PORT = Number(process.env.IMG_PORT) || 8491;
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
  // the demo's media: a <video> refuses an octet-stream, so these are typed
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".m4a": "audio/mp4",
};

// ---------- the demo recorder ----------

// one job at a time: a press while a recording runs joins that recording
const jobs = new Map();
let running = null;
const DEMO_URL = `http://localhost:${PORT}/#/p/new-project-hlug`;

function startRecording() {
  if (running && jobs.get(running).state === "running") return jobs.get(running);
  const id = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dir = join(ROOT, ".tmp", "recordings", id);
  const job = { id, state: "running", phase: "starting", startedAt: Date.now() };
  jobs.set(id, job);
  running = id;
  const child = spawn(process.execPath, [join(ROOT, "record.mjs"), "--url", DEMO_URL, "--out", dir], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
  let stderr = "";
  let tail = "";
  child.stderr.on("data", (d) => (stderr = (stderr + d).slice(-2000)));
  // the recorder speaks one JSON line per phase and one at the end
  child.stdout.on("data", (d) => {
    tail += d;
    const lines = tail.split("\n");
    tail = lines.pop();
    for (const line of lines) {
      let msg;
      try { msg = JSON.parse(line); } catch { continue; }
      if (msg.phase) job.phase = msg.phase;
      if (msg.done) Object.assign(job, { file: msg.file, seconds: msg.seconds, bytes: msg.bytes, filename: `dawn-demo-${id}${extname(msg.file)}`, url: `/api/demo/record/${id}/${basename(msg.file)}` });
    }
  });
  child.on("error", (err) => {
    console.error(err);
    Object.assign(job, { state: "failed", error: err.message });
  });
  child.on("exit", (code) => {
    if (job.file && code === 0) job.state = "done";
    else Object.assign(job, { state: "failed", error: stderr.trim().split("\n").pop() || `recorder exited ${code}` });
    console.log(`recording ${id}: ${job.state}${job.error ? ` (${job.error})` : ` ${job.file}`}`);
  });
  return job;
}

const json = (res, code, body) => {
  res.writeHead(code, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};

async function recorderRoute(req, res, url) {
  const [, id, file] = url.pathname.match(/^\/api\/demo\/record(?:\/([\w-]+))?(?:\/([\w.-]+))?$/) || [];
  if (!id && req.method === "POST") return json(res, 202, startRecording());
  // the page asks here whether a recorder exists before it shows the button:
  // a static host (GitHub Pages) answers this address with a 404
  if (!id) return json(res, 200, { recorder: true, running: running && jobs.get(running).state === "running" ? running : null });
  const job = jobs.get(id);
  if (!job) return json(res, 404, { error: "no such recording" });
  if (!file) return json(res, 200, job);
  if (job.state !== "done" || basename(job.file) !== file) return json(res, 404, { error: "not ready" });
  const body = await readFile(job.file);
  res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream", "content-length": body.length, "content-disposition": `attachment; filename="${job.filename}"` });
  res.end(body);
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname.startsWith("/api/demo/record")) return await recorderRoute(req, res, url);
    if (url.pathname.includes("..")) { res.writeHead(404).end(); return; } // normalize collapses leading .., so reject before it can
    let path = normalize(decodeURIComponent(url.pathname));
    // backend leftovers (server/, untracked on disk) and dotfiles (.env, .git)
    // are never served, and clients squash ".." before it reaches us, so segment
    // checks beat a literal ".." test
    if (/^\/(server($|\/)|\.)/.test(path)) { res.writeHead(404).end(); return; }
    if (path === "/" || path === "\\") path = "/index.html";
    const abs = resolve(join(ROOT, path));
    if (!abs.startsWith(resolve(ROOT))) { res.writeHead(403).end(); return; }
    const body = await readFile(abs);
    res.writeHead(200, { "content-type": TYPES[extname(abs)] || "application/octet-stream" });
    res.end(body);
  } catch (err) {
    // a missing /health or /api/* is the frontend's signal to run standalone
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: err.code === "ENOENT" ? "not found" : "error" }));
  }
}).listen(PORT, () => console.log(`frontend on http://localhost:${PORT}/`));
