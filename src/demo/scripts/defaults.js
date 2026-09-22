// demo/scripts/defaults.js: the compatibility adapter between a script and
// the player.
//
// The player's contract grew while the first goal scripts were being written
// (firstLength, logs, embedUrl, numbers.stats arrived after they were
// dispatched). Rather than leave five scripts silently short of the shape
// run.js wants, this fills the gaps with the SAME values the flagship script
// carries, and REPORTS what it filled. A default that nobody hears about is a
// lie the demo tells; this one is logged, listed by validateScript, and named
// in the P16 report.
//
// A script that declares the field is never touched: this only ever adds.

const FILLED_FLAGS = new Set();

export function withPlayDefaults(s) {
  const filled = [];
  const out = { ...s };
  if (!out.firstLength) {
    out.firstLength = out.weekUploadLengths?.[0] || "first run";
    filled.push("firstLength");
  }
  if (!out.logs) {
    out.logs = { upload: "work", day: "day", delta: "win" };
    filled.push("logs");
  }
  if (typeof out.embedUrl !== "function") {
    // no embed for this goal: the browser window shows the artifact's own
    // address instead of an iframe, so a non-video goal never frames a
    // player it has nothing for
    out.embedUrl = null;
    filled.push("embedUrl");
  }
  if (filled.length) FILLED_FLAGS.add(`${out.id}: ${filled.join(", ")}`);
  return out;
}

// what the adapter had to fill, for the gate report
export const defaultedFields = () => [...FILLED_FLAGS];