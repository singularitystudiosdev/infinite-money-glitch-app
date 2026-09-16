// demo/record.js: the Record button on the demo route. One press asks the
// server (POST /api/demo/record) to play the whole run in a headless
// browser and save it as a video, and the button leaves the page: it reads
// the job back every two seconds out of sight and comes back only with
// something to hand over, the download once the run is done, or the retry
// if it failed. The recording browser is told it is one
// (window.__demoRecording), so the button never appears in its own video.
// The button only exists where a recorder does: serve.mjs answers
// GET /api/demo/record, a static host (the public GitHub Pages copy) does
// not, and there the demo plays with nothing over it.
import { icon } from "../icons.js";
import { escapeHtml } from "../util.js";

const RED_DOT = `<svg class="icon-16 demo-record__dot" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6" fill="currentColor"/></svg>`;

let button = null;
let poll = null;
let mounting = 0;

export function mountRecordButton() {
  unmountRecordButton();
  if (window.__demoRecording) return;
  const attempt = ++mounting;
  hasRecorder().then((ok) => {
    // the route may have changed while the probe was out
    if (!ok || attempt !== mounting) return;
    button = document.createElement("div");
    button.className = "demo-record";
    document.body.append(button);
    idle();
  });
}

export function unmountRecordButton() {
  mounting++;
  clearInterval(poll);
  poll = null;
  button?.remove();
  button = null;
}

async function hasRecorder() {
  try {
    const r = await fetch("/api/demo/record", { signal: AbortSignal.timeout(2500) });
    if (!r.ok) return false;
    return (await r.json()).recorder === true;
  } catch {
    return false;
  }
}

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

const show = () => button.classList.remove("is-hidden");
const hide = () => button.classList.add("is-hidden");

function idle(problem = "") {
  show();
  button.innerHTML = `<button type="button" class="demo-record__btn${problem ? " is-failed" : ""}" data-demo-record title="${escapeHtml(problem || "Record the whole demo, end to end, as a video")}">${RED_DOT}<span>${problem ? "Failed, try again" : "Record"}</span></button>`;
  button.querySelector("[data-demo-record]").addEventListener("click", start);
}

// the press is the last of the button until the recording has something
// to give back
async function start() {
  hide();
  try {
    const r = await fetch("/api/demo/record", { method: "POST" });
    if (!r.ok) throw new Error(`server said ${r.status}`);
    const job = await r.json();
    watch(job.id);
  } catch (err) {
    console.error(err);
    idle(err.message);
  }
}

function watch(id) {
  clearInterval(poll);
  const tick = async () => {
    let job;
    try {
      const r = await fetch(`/api/demo/record/${encodeURIComponent(id)}`);
      if (!r.ok) throw new Error(`server said ${r.status}`);
      job = await r.json();
    } catch (err) {
      console.error(err);
      clearInterval(poll);
      poll = null;
      idle(err.message);
      return;
    }
    if (!button) return;
    // still running: the button stays away
    if (job.state === "running") return;
    clearInterval(poll);
    poll = null;
    if (job.state === "done") {
      const mb = job.bytes ? ` · ${(job.bytes / 1048576).toFixed(0)} MB` : "";
      button.innerHTML = `<a class="demo-record__btn is-done" href="${escapeHtml(job.url)}" download="${escapeHtml(job.filename)}">${icon("download")}<span>Download ${job.seconds ? fmt(job.seconds) : "video"}${mb}</span></a><button type="button" class="demo-record__again" data-demo-again title="Record again">${icon("rotate-ccw")}</button>`;
      button.querySelector("[data-demo-again]").addEventListener("click", () => idle());
      show();
      return;
    }
    idle(job.error || "recording failed");
  };
  tick();
  poll = setInterval(tick, 2000);
}
