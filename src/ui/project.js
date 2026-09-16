// project.js: one project the way ChatGPT lays a conversation out: the
// projects rail at the left, the chat in the middle with the composer at
// the foot, and at the right the setup checklist (until it is done) or the
// analytics, with the project's activity log under either.
import { icon } from "../icons.js";
import { navigate } from "../router.js";
import { deleteProject, get, isRunning, openProject, project, railLayout, renameProject, setSide, subscribe } from "../store.js";
import { EASE_OUT, announce, escapeHtml, reduceMotion } from "../util.js";
import { renderChat } from "./chat.js";
import { confirmDialog, renameDialog, settle } from "./dialog.js";
import { startNewProject } from "./home.js";
import { renderLog } from "./log.js";
import { renderRunning } from "./running.js";
import { renderSide } from "./side.js";

// the project's own actions, on a small menu at the right of the chat head
// rename and delete; pausing lives on the composer's strip
const MENU = [
  { id: "rename", icon: "pencil", label: "Rename project" },
  { id: "delete", icon: "trash", label: "Delete project", danger: true },
];
// the ways the right rail can be arranged, top to bottom. numbers is the
// analytics card; activity is the missions with the whole log under them;
// tasks is the missions alone; updates is the log cut to what is worth a
// look (insights, sales, breakthroughs, asks). Picked at the rail's top.
export const LAYOUTS = [
  { id: "classic", label: "Classic", cards: ["numbers", "activity"] },
  { id: "activity", label: "Activity first", cards: ["activity", "numbers"] },
  { id: "split", label: "Tasks and updates", cards: ["numbers", "tasks", "updates"] },
  { id: "split-first", label: "Tasks and updates first", cards: ["tasks", "updates", "numbers"] },
  { id: "updates", label: "Updates only", cards: ["numbers", "updates"] },
];

const menuMarkup = () => `<span class="c-dd app-chat__menu"><button type="button" class="btn btn--icon btn--quiet" data-menu aria-haspopup="menu" aria-expanded="false" aria-label="Project options">${icon("ellipsis")}</button><div class="c-menu panel" role="menu" aria-label="Project options" hidden>${MENU.map((m) => `<button type="button" class="c-menu__item${m.danger ? " c-menu__item--danger" : ""}" role="menuitem" data-action="${m.id}">${icon(m.icon)}<span class="c-menu__text">${m.label}</span></button>`).join("")}</div></span>`;

export function render(root, { id }) {
  const p = project(id);
  if (!p) {
    root.innerHTML = `<section class="app-missing"><span class="c-flow__done-mark">${icon("folder-open")}</span><h1 class="app-missing__title">No project here</h1><p>That project was deleted or never existed.</p><a class="btn" href="#/">Back to projects</a></section>`;
    // live mode: the snapshot may still be landing over the wire — re-render
    // the moment this project is ingested instead of leaving a dead deep link
    let cleanup = null;
    const off = subscribe((topic) => {
      if (topic !== "projects" || !project(id)) return;
      off();
      cleanup = render(root, { id });
    });
    return () => {
      off();
      if (cleanup) cleanup();
    };
  }
  openProject(id);
  document.title = `${p.name}`;
  const running = isRunning(p);
  // under 1100px the rail rides over the page: it starts closed whatever a
  // wide window stored, opens from the chat head, and closes on the scrim,
  // its own toggle, Escape, or a pick (a pick re-renders the page)
  const narrow = matchMedia("(max-width: 1100px)");
  let over = false;
  const sideOpen = () => (narrow.matches ? over : get().side.open);
  root.innerHTML = `<section class="app-project${sideOpen() ? " is-side-open" : ""}${running ? "" : " is-setup"}" data-project="${escapeHtml(id)}">
  <aside class="app-project__side" data-side-root></aside>
  <div class="app-project__scrim" data-side-scrim></div>
  <nav class="app-pager" data-pager${running ? "" : " hidden"}><div class="app-pager__tabs" role="tablist" aria-label="Chat or analytics"><button type="button" class="app-pager__tab" role="tab" data-pane="chat" aria-selected="true" aria-controls="app-pane-chat">Chat</button><button type="button" class="app-pager__tab" role="tab" data-pane="rail" aria-selected="false" aria-controls="app-pane-rail">Analytics</button></div></nav>
  <div class="app-project__chat" id="app-pane-chat" data-chat-root></div>
  <aside class="app-project__rail" id="app-pane-rail"${running ? "" : " hidden"}><div class="app-rail__cards" data-rail-cards></div></aside>
</section>`;
  const section = root.querySelector(".app-project");
  // on a phone the chat and the analytics are two pages side by side: a
  // swipe snaps between them (CSS scroll snap on the section), the tabs
  // above say which is in view and take you to the other
  const pager = section.querySelector("[data-pager]");
  const paneAt = () => (section.clientWidth ? Math.round(section.scrollLeft / section.clientWidth) : 0);
  function paintPager() {
    const i = paneAt();
    pager.style.setProperty("--pane", String(i));
    for (const tab of pager.querySelectorAll("[data-pane]")) tab.setAttribute("aria-selected", String((tab.dataset.pane === "rail") === (i === 1)));
  }
  function goPane(name) {
    section.scrollTo({ left: name === "rail" ? section.clientWidth : 0, behavior: reduceMotion() ? "auto" : "smooth" });
  }
  pager.addEventListener("click", (e) => {
    const tab = e.target.closest("[data-pane]");
    if (tab) goPane(tab.dataset.pane);
  });
  pager.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") goPane("rail");
    else if (e.key === "ArrowLeft") goPane("chat");
  });
  section.addEventListener("scroll", paintPager, { passive: true });
  const cleanups = [];
  cleanups.push(renderSide(root.querySelector("[data-side-root]"), id, { onNew: startNewProject }));
  const chat = renderChat(root.querySelector("[data-chat-root]"), id);
  cleanups.push(chat.destroy);

  // the rail exists only once the project is set up: the analytics, then
  // the log; until then the chat has the page and carries the setup itself
  const rail = root.querySelector(".app-project__rail");
  const cards = rail.querySelector("[data-rail-cards]");
  const CARDS = {
    numbers: (el) => renderRunning(el, id),
    activity: (el) => renderLog(el, id),
    tasks: (el) => renderLog(el, id, { mode: "tasks" }),
    updates: (el) => renderLog(el, id, { mode: "updates" }),
  };
  let railOn = false;
  let railLayout_ = null;
  let railCleanup = () => {};
  function paintRail({ animate = true } = {}) {
    const on = isRunning(project(id));
    const layout = LAYOUTS.find((l) => l.id === railLayout()) || LAYOUTS[0];
    if (on === railOn && layout.id === railLayout_) return;
    const wasOn = railOn;
    railOn = on;
    railLayout_ = layout.id;
    railCleanup();
    railCleanup = () => {};
    section.classList.toggle("is-setup", !on);
    rail.hidden = !on;
    pager.hidden = !on;
    cards.innerHTML = "";
    if (!on) return;
    const offs = layout.cards.map((kind) => {
      const el = document.createElement("div");
      el.dataset.card = kind;
      cards.append(el);
      return CARDS[kind](el);
    });
    // a log card at the foot takes what is left and scrolls inside itself;
    // any other arrangement keeps every card at its own height, and the
    // rail scrolls as a whole if they do not all fit
    // short on space, the updates card gives up a row (is-tight, read by
    // the log) before the rail is made to scroll
    const tell = () => {
      for (const el of cards.children) el.dispatchEvent(new Event("rail:fit"));
    };
    const overflows = () => cards.scrollHeight > cards.clientHeight + 1;
    const fit = () => {
      const flexLast = ["activity", "updates"].includes(layout.cards.at(-1));
      cards.classList.remove("is-scrolling", "is-tight");
      cards.style.gridTemplateRows = flexLast ? `${"auto ".repeat(layout.cards.length - 1)}minmax(0, 1fr)` : "";
      tell();
      if (overflows() && layout.cards.includes("updates")) {
        cards.classList.add("is-tight");
        tell();
      }
      if (!flexLast || overflows()) {
        cards.style.gridTemplateRows = "";
        cards.classList.add("is-scrolling");
      }
    };
    fit();
    window.addEventListener("resize", fit);
    // the rail's column animates open after setup: fit again once its
    // size has settled, not only on a window resize
    let lastSize = "";
    const sizes = new ResizeObserver(() => {
      const size = `${Math.round(cards.clientWidth)}x${Math.round(cards.clientHeight)}`;
      if (size === lastSize) return;
      lastSize = size;
      fit();
    });
    sizes.observe(cards);
    railCleanup = () => {
      window.removeEventListener("resize", fit);
      sizes.disconnect();
      // a card factory that has nothing to unsubscribe returns undefined
      // (a live-rail branch), so only call the functions
      offs.forEach((off) => typeof off === "function" && off());
    };
    if (!animate || reduceMotion()) return;
    if (!wasOn) rail.animate([{ opacity: 0, transform: "translateX(12px)" }, { opacity: 1, transform: "translateX(0)" }], { duration: 300, easing: EASE_OUT });
    else cards.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: EASE_OUT });
  }
  paintRail({ animate: false });

  const head = root.querySelector(".app-chat__head");
  head.insertAdjacentHTML("beforeend", menuMarkup());
  // with the rail folded away, the button that brings it back sits at the
  // left of the chat head, where the rail's own toggle was
  head.insertAdjacentHTML("afterbegin", `<button type="button" class="btn btn--icon btn--quiet app-chat__open" data-side-open aria-label="Show the projects rail" aria-expanded="${sideOpen()}"${sideOpen() ? " hidden" : ""}>${icon("panel-left")}</button>`);
  const openSide = head.querySelector("[data-side-open]");
  function paintSide() {
    const open = sideOpen();
    section.classList.toggle("is-side-open", open);
    openSide.hidden = open;
    openSide.setAttribute("aria-expanded", String(open));
    const toggle = section.querySelector("[data-side-toggle]");
    if (toggle && narrow.matches) {
      toggle.setAttribute("aria-pressed", String(open));
      toggle.setAttribute("aria-label", `${open ? "Hide" : "Show"} the projects rail`);
    }
  }
  // the overlay's focus contract: into the rail on open, back to the
  // opener on close
  function setOver(on) {
    over = on;
    paintSide();
    if (on) (section.querySelector(".app-side [aria-current='page']") || section.querySelector(".app-side [data-project]") || section.querySelector("[data-side-toggle]"))?.focus();
    else openSide.focus();
  }
  openSide.addEventListener("click", () => (narrow.matches ? setOver(true) : setSide({ open: true })));
  section.querySelector("[data-side-scrim]").addEventListener("click", () => setOver(false));
  // over the page, the rail's own toggle closes the overlay and leaves what
  // a wide window remembers alone; a pick closes it too
  section.addEventListener(
    "click",
    (e) => {
      if (!narrow.matches || !over) return;
      if (e.target.closest("[data-side-toggle]")) {
        e.stopPropagation();
        setOver(false);
      } else if (e.target.closest("[data-project], [data-side-new]")) {
        over = false;
        paintSide();
      }
    },
    true,
  );
  const onKey = (e) => {
    if (e.key === "Escape" && narrow.matches && over) setOver(false);
  };
  document.addEventListener("keydown", onKey);
  const onNarrow = () => {
    over = false;
    paintSide();
    section.scrollLeft = 0;
    paintPager();
  };
  narrow.addEventListener("change", onNarrow);
  cleanups.push(() => {
    document.removeEventListener("keydown", onKey);
    narrow.removeEventListener("change", onNarrow);
  });
  const actions = {
    rename: async () => {
      const name = await renameDialog(project(id).name);
      if (name) {
        renameProject(id, name);
        document.title = name;
        chat.setTitle(name);
        announce(`Renamed to ${name}`);
      }
    },
    delete: async () => {
      if (!(await confirmDialog({ title: `Delete ${project(id).name}?`, text: "The project, its conversation and its numbers go. This cannot be undone.", action: "Delete project", danger: true }))) return;
      await settle();
      deleteProject(id);
      announce("Project deleted");
      navigate("/");
    },
  };
  head.addEventListener("click", (e) => {
    const item = e.target.closest("[data-action]");
    if (!item) return;
    const dd = item.closest(".c-dd");
    dd.querySelector(".c-menu").hidden = true;
    dd.querySelector("[data-menu]").setAttribute("aria-expanded", "false");
    actions[item.dataset.action]?.();
  });

  const off = subscribe((topic, payload) => {
    if (!root.isConnected) return;
    if (topic === "setup" && payload.id === id) paintRail();
    else if (topic === "rail") paintRail();
    else if (topic === "side") paintSide();
    else if (topic === "projects" && payload?.removed === id) navigate("/");
    else if (topic === "reset") navigate("/");
  });
  cleanups.push(off, () => railCleanup());
  return () => cleanups.forEach((fn) => fn());
}
