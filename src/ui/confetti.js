// confetti.js: the paper burst that marks a purchase. One cannon: squares
// shoot up from the bottom edge fast enough to reach the top of the
// screen, hang there for a beat, then float down tumbling and swaying.
// Drawn on one canvas in the top layer (a manual popover), so it rides
// over the settings modal, and never takes a pointer event.
import { reduceMotion } from "../util.js";

const COLORS = ["#ff5c7a", "#ffb443", "#ffe45c", "#4cd97b", "#4aa8ff", "#b784ff", "#ff7ad9"];
const COUNT = 160;
// pixels per frame squared on the way down; the way up is drag-free so a
// launch speed lands exactly where it is aimed
const GRAVITY = 0.42;

const rand = (lo, hi) => lo + Math.random() * (hi - lo);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

let canvas = null;
let ctx = null;
let particles = [];
let frame = 0;
let last = 0;

function mount() {
  if (canvas) return;
  canvas = document.createElement("canvas");
  canvas.className = "app-confetti";
  canvas.setAttribute("aria-hidden", "true");
  document.body.append(canvas);
  // the top layer, above any open dialog; a browser without popovers
  // draws it in the page, under the modal but still on the screen
  if (canvas.showPopover) {
    canvas.setAttribute("popover", "manual");
    try {
      canvas.showPopover();
    } catch (err) {
      console.error(err);
    }
  }
  ctx = canvas.getContext("2d");
  size();
  addEventListener("resize", size);
}

function size() {
  if (!canvas) return;
  const dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = Math.round(innerWidth * dpr);
  canvas.height = Math.round(innerHeight * dpr);
  canvas.style.width = `${innerWidth}px`;
  canvas.style.height = `${innerHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function unmount() {
  if (!canvas) return;
  removeEventListener("resize", size);
  if (canvas.hidePopover && canvas.matches(":popover-open")) canvas.hidePopover();
  canvas.remove();
  canvas = null;
  ctx = null;
}

// one square, fired from a point on the bottom edge. Its launch speed is
// worked back from the screen height (v = sqrt(2 g h)), so it peaks
// between 85% and 105% of the way up whatever the window's size; a
// little sideways speed fans the burst out
function piece(x) {
  const s = rand(7, 13);
  const apex = innerHeight * rand(0.85, 1.05) + 20;
  const vy = -Math.sqrt(2 * GRAVITY * apex);
  return {
    color: pick(COLORS),
    x,
    y: innerHeight + 10,
    vx: rand(-1, 1) * vy * -0.28,
    vy,
    w: s,
    h: s * rand(0.7, 1.3),
    rot: rand(0, Math.PI * 2),
    vrot: rand(-0.2, 0.2),
    tilt: rand(0, Math.PI * 2),
    vtilt: rand(0.1, 0.22),
    fall: rand(2.8, 4.9),
    swayPhase: rand(0, Math.PI * 2),
    sway: rand(0.5, 1.1),
    life: 0,
  };
}

// the tilt is a flip about the square's own axis: its width breathes,
// and the far side of the flip is a shade darker
function draw(p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  const flip = Math.cos(p.tilt);
  ctx.scale(Math.abs(flip) < 0.04 ? 0.04 : flip, 1);
  ctx.fillStyle = p.color;
  ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
  if (flip < 0) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.14)";
    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
  }
  ctx.restore();
}

function step(now) {
  const dt = Math.min(2, (now - last) / 16.7 || 1);
  last = now;
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  particles = particles.filter((p) => p.y < innerHeight + 40 && p.life < 700);
  for (const p of particles) {
    p.life += dt;
    p.vy += GRAVITY * dt;
    // once it is falling, air catches it: it settles to its own fall
    // speed, the sideways push dies away and it sways down instead
    if (p.vy > 0) {
      p.vy = Math.min(p.vy, p.fall);
      p.vx *= 0.96;
      p.x += Math.sin(p.life * 0.08 + p.swayPhase) * p.sway * dt;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.vrot * dt;
    p.tilt += p.vtilt * dt;
    draw(p);
  }
  if (particles.length) frame = requestAnimationFrame(step);
  else {
    frame = 0;
    unmount();
  }
}

// fire the burst: two cannons a third of the way in from each side, plus
// one in the middle, all from the bottom edge
export function confetti({ count = COUNT } = {}) {
  if (reduceMotion()) return;
  mount();
  const mouths = [innerWidth * 0.28, innerWidth * 0.5, innerWidth * 0.72];
  for (let i = 0; i < count; i += 1) particles.push(piece(mouths[i % 3] + rand(-30, 30)));
  if (!frame) {
    last = performance.now();
    frame = requestAnimationFrame(step);
  }
}
