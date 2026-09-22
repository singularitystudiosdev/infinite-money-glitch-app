// main.js: the shell. Mounts the top strip, routes the hash to a page,
// listens for the keyboard, and starts the simulation that makes every
// number move. The look is the light theme, always.
import { navigate, onRoute } from "./router.js";
import { startSim } from "./sim.js";
import * as demo from "./demo/run.js";
import { initLive } from "./live.js";
import { addCredits, get, markAllRead, setSide } from "./store.js";
import { reduceMotion } from "./util.js";
import * as activity from "./ui/activity.js";
import { confetti } from "./ui/confetti.js";
import * as demos from "./ui/demos.js";
import { shortcutsDialog } from "./ui/dialog.js";
import * as home from "./ui/home.js";
import { openPalette, setPaletteActions } from "./ui/palette.js";
import * as project from "./ui/project.js";
import * as settings from "./ui/settings.js";

const PAGES = { home, project, settings, activity, demos };
const view = document.getElementById("view");
let cleanup = () => {};

function missing(root) {
  root.innerHTML = `<section class="app-missing"><h1 class="app-missing__title">Nothing at this address</h1><p>The link is out of date.</p><a class="btn" href="#/">Back to projects</a></section>`;
  return () => {};
}

let currentPage = null;
function show(route) {
  // there is no projects grid: the root address is a new chat. The draft
  // is reused, so landing here again and again stays one empty chat
  if (route.page === "home") {
    currentPage = "project";
    return home.startNewProject();
  }
  // chat to chat: the shell stays, only the middle and right panes change.
  // A view transition would hold every click for its whole run, so those
  // panes fade in on their own instead and the rail answers at once
  const chatSwitch = currentPage === "project" && route.page === "project";
  currentPage = route.page;
  const run = () => {
    cleanup();
    view.innerHTML = "";
    view.dataset.page = route.page;
    document.title = "Infinite money glitch";
    // the demo route makes its project fresh, renders it like any other,
    // then plays its script over the page
    const isDemo = demo.matches(route);
    if (isDemo) demo.prepare(route);
    const pageCleanup = (PAGES[route.page]?.render || missing)(view, route.params) || (() => {});
    cleanup = () => {
      demo.stop();
      pageCleanup();
    };
    if (isDemo) demo.start(view);
    view.scrollTop = 0;
  };
  if (chatSwitch || !document.startViewTransition || reduceMotion()) {
    run();
    if (chatSwitch && !reduceMotion()) {
      for (const pane of view.querySelectorAll(".app-project__chat, .app-project__rail")) pane.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: "cubic-bezier(0.05, 0.7, 0.1, 1)" });
    }
    return;
  }
  // a page that re-routes while it renders (an old settings link, say)
  // starts a second transition and skips this one; that is not an error
  const vt = document.startViewTransition(run);
  vt.ready.catch(() => {});
  vt.finished.catch(() => {});
}

// ---------- keyboard ----------

let chord = null;
const typing = (e) => e.target.closest("input, textarea, select, [contenteditable]");
document.addEventListener("keydown", (e) => {
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key.toLowerCase() === "k") {
    e.preventDefault();
    return openPalette();
  }
  if (mod && e.key.toLowerCase() === "b" && view.dataset.page === "project") {
    e.preventDefault();
    return setSide({ open: !get().side.open });
  }
  if (typing(e) || mod || e.altKey) return;
  if (chord === "g") {
    chord = null;
    if (e.key === "h") return navigate("/");
    if (e.key === "s") return navigate("/settings/credits");
    if (e.key === "a") return navigate("/activity");
    return;
  }
  if (e.key === "g") {
    chord = "g";
    setTimeout(() => (chord = null), 800);
  }
});

// ---------- start ----------

// a Stripe checkout redirects back here through /checkout/return, which the
// server only reaches after verifying the session is paid; it sends the
// granted amount as ?paid= in the hash and the account shows it
{
  const paid = Number((location.hash.match(/[?&]paid=(\d+)/) || [])[1]);
  if (paid > 0) {
    addCredits({ credits: paid, price: 0 });
    history.replaceState(null, "", location.pathname + location.search + "#/settings/credits");
    // the paper flies once the page is drawn under it
    setTimeout(confetti, 400);
  }
}

document.documentElement.dataset.theme = "light";
setPaletteActions({
  search: openPalette,
  demos: () => navigate("/demos"),
  settings: () => navigate("/settings/credits"),
  shortcuts: shortcutsDialog,
  newProject: home.startNewProject,
  readAll: markAllRead,
});
// on load, the app opens the last chat you had open; with none, the root
// address lands in a fresh new chat (the home route does that now). The
// client's seeded samples are not chats, so they never win the landing
if (!location.hash || location.hash === "#/") {
  const last = get().projects.find((p) => p.id === get().currentId && p.server) || get().projects.find((p) => p.server);
  if (last) navigate(`/p/${encodeURIComponent(last.id)}`, { replace: true });
}
onRoute(show);
// a live agent backend owns every number and every thread when it answers;
// the sim only runs when there is no backend
// a demo run owns the page while it plays; the sim starts when it is over
initLive().then((ok) => { if (!ok && !demo.isActive()) startSim(); });
