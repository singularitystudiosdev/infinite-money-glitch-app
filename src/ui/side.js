// side.js: the projects rail at the left of a chat, the way ChatGPT keeps
// its conversations: All projects and New at the top, a search, one row a
// project with the line its agent is on, the open one marked, and the
// account at the foot. Rows keep the order you gave them: opening one
// never moves it, and you drag a row to put it where you want.
import { icon } from "../icons.js";
import { navigate, projectPath } from "../router.js";
import { busyBy, connectorsPending, deleteProject, get, listed, project, setPaused, setSide, subscribe } from "../store.js";
import { liveConnected } from "../live.js";
import { EASE_OUT, announce, escapeHtml, reduceMotion } from "../util.js";
import { avatarMarkup } from "./avatar.js";
import { confirmDialog } from "./dialog.js";
import { openSettingsDialog } from "./settings.js";

// the kept order first, then anything not yet placed, newest first.
// while the live backend owns the app, its projects are the chats; the
// client's seeded samples would only be noise in the rail
function ordered() {
  const order = get().side.order || [];
  const rank = new Map(order.map((id, i) => [id, i]));
  const live = liveConnected();
  return [...listed()].filter((p) => !live || p.server).sort((a, b) => {
    const ra = rank.has(a.id) ? rank.get(a.id) : Infinity;
    const rb = rank.has(b.id) ? rank.get(b.id) : Infinity;
    return ra === rb ? b.createdAt - a.createdAt : ra - rb;
  });
}

// the rail is rebuilt on every chat switch; where you had scrolled it to
// survives the rebuild
let railScroll = 0;

export function renderSide(root, currentId, { onNew } = {}) {
  let query = "";
  // the row's mark: a spinning circle while the agent is thinking, a plain
  // circle otherwise (a paused row reads in the row's menu)
  const dotFor = (p) => (busyBy(p.id) === "agent"
    ? `<span class="app-side__dot is-busy" role="img" aria-label="Thinking">${icon("loader-circle", "btn__spinner")}</span>`
    : `<span class="app-side__dot is-idle"${p.paused ? ' role="img" aria-label="Paused"' : ' aria-hidden="true"'}></span>`);
  // the one count a row carries: connectors waiting on you, in orange
  const needsFor = (p) => {
    const n = connectorsPending(p);
    return n ? `<span class="btn__dot app-side__needs" data-count="${n > 9 ? "9+" : n}" role="img" aria-label="${n} connector${n === 1 ? "" : "s"} to connect"></span>` : "";
  };
  // pause is offered only where there is work to hold: busy now, a mission
  // running, or already paused (so Resume is always reachable)
  const working = (p) => p.paused || busyBy(p.id) === "agent" || (p.missions || []).some((m) => m.status === "running");
  const rowMenu = (p) => `${working(p)
    ? `<button type="button" class="c-menu__item" role="menuitem" data-side-pause="${p.id}">${icon(p.paused ? "play" : "pause")}<span class="c-menu__text">${p.paused ? "Resume the agent" : "Pause the agent"}</span></button>`
    : ""}<button type="button" class="c-menu__item c-menu__item--danger" role="menuitem" data-side-delete="${p.id}">${icon("trash")}<span class="c-menu__text">Delete chat</span></button>`;
  const row = (p) => `<li data-id="${p.id}"><a class="app-side__item" href="#${projectPath(p.id)}" data-project="${p.id}" draggable="false"${p.id === currentId ? ' aria-current="page"' : ""}>
  ${dotFor(p)}
  <span class="app-side__text"><span class="app-side__name">${escapeHtml(p.name)}</span></span>${needsFor(p)}
</a><button type="button" class="app-side__dots" data-dots aria-haspopup="menu" aria-expanded="false" aria-label="Chat actions">${icon("ellipsis")}</button>
<div class="c-menu panel app-side__menu" role="menu" aria-label="Chat actions" data-menu hidden>
  ${rowMenu(p)}
</div></li>`;

  root.innerHTML = `<nav class="app-side" aria-label="Projects">
  <div class="app-side__top">
    <div class="app-side__row"><button type="button" class="app-side__new" data-side-new aria-label="New project">${icon("plus")}<span>New project</span></button><button type="button" class="btn btn--icon btn--quiet app-side__toggle" data-side-toggle aria-pressed="${get().side.open}" aria-label="${get().side.open ? "Hide" : "Show"} the projects rail">${icon("panel-left")}</button><button type="button" class="btn btn--icon btn--quiet app-side__find" data-side-find aria-label="Find a project">${icon("search")}</button></div>
    <label class="app-side__search">${icon("search")}<input type="search" placeholder="Find a project" aria-label="Find a project" autocomplete="off"></label>
  </div>
  <ul class="app-side__list" data-side-list aria-label="Projects, drag to reorder"></ul>
  <div class="app-side__empty" data-side-empty hidden><span data-side-empty-text></span><button type="button" class="btn btn--quiet" data-side-empty-action></button></div>
  <button type="button" class="app-side__foot" data-side-settings aria-label="Settings">${avatarMarkup(get().user, "app-avatar--small")}<span class="app-side__text"><span class="app-side__name">${escapeHtml(get().user.name)}</span><span class="app-side__sub">${get().credits.balance.toLocaleString("en-US")} credits</span></span>${icon("settings")}</button>
</nav>`;
  const list = root.querySelector("[data-side-list]");
  root.querySelector("[data-side-settings]").addEventListener("click", () => openSettingsDialog("account"));

  function paint() {
    const q = query.trim().toLowerCase();
    const shown = ordered().filter((p) => !q || p.name.toLowerCase().includes(q));
    list.innerHTML = shown.map(row).join("");
    // a search with no match shows an empty list and nothing else; the
    // note and its button are for a workspace with no projects at all
    const empty = root.querySelector("[data-side-empty]");
    empty.hidden = listed().length > 0;
    root.querySelector("[data-side-empty-text]").textContent = "No projects yet.";
    root.querySelector("[data-side-empty-action]").textContent = "New project";
  }

  // ---------- drag to reorder ----------

  // pointer-driven, not the browser's own drag and drop: the row in hand
  // follows the pointer on a transform, the rows around it slide into
  // their new places (FLIP: measure, move, animate from where they were),
  // and the order is kept on release. The native kind froze mid-drag in
  // WebKit the moment the row was moved in the DOM.
  function flip(move, held) {
    const before = new Map([...list.children].map((li) => [li, li.getBoundingClientRect().top]));
    move();
    if (reduceMotion()) return;
    for (const li of list.children) {
      if (li === held) continue;
      const d = (before.get(li) ?? li.getBoundingClientRect().top) - li.getBoundingClientRect().top;
      if (d) li.animate([{ transform: `translateY(${d}px)` }, { transform: "none" }], { duration: 160, easing: EASE_OUT });
    }
  }

  let drag = null;
  // a click that lands right after a drag is the release, not a pick
  let draggedUntil = 0;
  const justDragged = () => performance.now() < draggedUntil;
  // where the held row wants its top edge, in the list's own coordinates
  const wantedTop = (e) => e.clientY - list.getBoundingClientRect().top + list.scrollTop - drag.grab;
  const placeHeld = (e) => {
    drag.li.style.transform = `translateY(${wantedTop(e) - drag.li.offsetTop}px)`;
  };
  list.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    const li = e.target.closest("li[data-id]");
    if (!li) return;
    drag = { li, id: e.pointerId, startY: e.clientY, grab: e.clientY - li.getBoundingClientRect().top, active: false };
  });
  list.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.active) {
      if (Math.abs(e.clientY - drag.startY) < 6) return;
      drag.active = true;
      try {
        list.setPointerCapture(e.pointerId);
      } catch (err) {
        console.error(err);
      }
      drag.li.classList.add("is-dragging");
      list.classList.add("is-reordering");
    }
    e.preventDefault();
    // the slot: past the middle of the row above, it goes above it; past
    // the middle of the row below, below it. One step per move
    const held = drag.li;
    const mid = wantedTop(e) + held.offsetHeight / 2;
    const prev = held.previousElementSibling;
    const next = held.nextElementSibling;
    if (prev && mid < prev.offsetTop + prev.offsetHeight / 2) flip(() => list.insertBefore(held, prev), held);
    else if (next && mid > next.offsetTop + next.offsetHeight / 2) flip(() => list.insertBefore(next, held), held);
    placeHeld(e);
  });
  const release = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const { li, active } = drag;
    drag = null;
    if (!active) return;
    draggedUntil = performance.now() + 250;
    list.classList.remove("is-reordering");
    li.classList.remove("is-dragging");
    // the row settles into its slot from where it was let go
    const from = li.style.transform;
    li.style.transform = "";
    if (!reduceMotion() && from) li.animate([{ transform: from }, { transform: "none" }], { duration: 160, easing: EASE_OUT });
    // the order on screen becomes the kept order; rows hidden by a search
    // keep their old places relative to the rest
    const shown = [...list.children].map((x) => x.dataset.id);
    const old = ordered().map((p) => p.id);
    const merged = [];
    let i = 0;
    for (const id of old) merged.push(shown.includes(id) ? shown[i++] : id);
    setSide({ order: merged });
    announce("Projects reordered");
  };
  list.addEventListener("pointerup", release);
  list.addEventListener("pointercancel", release);

  root.addEventListener("click", (e) => {
    if (e.target.closest("[data-side-new]")) return onNew?.();
    if (e.target.closest("[data-side-toggle]")) return setSide({ open: !get().side.open });
    if (e.target.closest("[data-side-find]")) {
      // unfold, then put the cursor in the search field once it is there
      setSide({ open: true });
      setTimeout(() => root.querySelector(".app-side__search input")?.focus(), reduceMotion() ? 0 : 320);
      return;
    }
    if (e.target.closest("[data-side-empty-action]")) return onNew?.();
    // the row's 3-dot menu: pause or delete the chat from the rail itself
    const dots = e.target.closest("[data-dots]");
    if (dots) {
      e.preventDefault();
      const li = dots.closest("li");
      const menu = li.querySelector("[data-menu]");
      const open = menu.hidden;
      for (const m of list.querySelectorAll("[data-menu]")) m.hidden = true;
      for (const d of list.querySelectorAll("[data-dots]")) d.setAttribute("aria-expanded", "false");
      menu.hidden = !open;
      dots.setAttribute("aria-expanded", String(!open));
      return;
    }
    if (!e.target.closest("[data-menu]")) for (const m of list.querySelectorAll("[data-menu]")) m.hidden = true;
    const pauseBtn = e.target.closest("[data-side-pause]");
    if (pauseBtn) {
      const id = pauseBtn.dataset.sidePause;
      const p = project(id);
      setPaused(id, !p.paused);
      announce(p.paused ? "Agent paused" : "Agent resumed");
      paint();
      return;
    }
    const deleteBtn = e.target.closest("[data-side-delete]");
    if (deleteBtn) {
      const id = deleteBtn.dataset.sideDelete;
      const p = project(id);
      confirmDialog({ title: "Delete this chat?", text: `${p.name} and its whole thread go away for good.`, action: "Delete", danger: true }).then((ok) => {
        if (!ok) return;
        deleteProject(id);
        fetch("/api/project/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId: id }) }).catch(() => {});
        announce("Chat deleted");
        if (id === currentId) navigate("/");
      });
      return;
    }
    const item = e.target.closest("[data-project]");
    if (item) {
      e.preventDefault();
      // letting go of a dragged row is not a click on it
      if (justDragged()) return;
      navigate(projectPath(item.dataset.project));
    }
  });
  root.querySelector("input").addEventListener("input", (e) => {
    query = e.target.value;
    paint();
  });
  paint();
  list.scrollTop = railScroll;
  list.addEventListener("scroll", () => (railScroll = list.scrollTop), { passive: true });

  // a connector landing or getting solved swaps the row's orange count in place
  function paintNeeds(id) {
    const li = list.querySelector(`li[data-id="${id}"]`);
    const p = project(id);
    if (!li || !p) return;
    li.querySelector(".app-side__needs")?.remove();
    li.querySelector(".app-side__item").insertAdjacentHTML("beforeend", needsFor(p));
  }

  const off = subscribe((topic, payload) => {
    if (!root.isConnected) return;
    // the rows carry one count, connectors waiting; the home tiles show the rest
    if (topic === "project:badges" && payload?.id) paintNeeds(payload.id);
    else if (topic === "thread" && payload?.id && payload.item?.kind === "action") paintNeeds(payload.id);
    else if (topic === "credits") {
      root.querySelector(".app-side__foot .app-side__sub").textContent = `${get().credits.balance.toLocaleString("en-US")} credits`;
    } else if (topic === "projects" || topic === "reset") {
      paint();
    } else if (topic === "busy" && payload.id) {
      // an agent starting or stopping swaps its row's dot and menu in place
      const li = list.querySelector(`li[data-id="${payload.id}"]`);
      const p = project(payload.id);
      if (li && p) {
        li.querySelector(".app-side__item .app-side__dot").outerHTML = dotFor(p);
        li.querySelector(".app-side__menu").innerHTML = rowMenu(p);
      }
    } else if (topic === "user") {
      root.querySelector(".app-side__foot .app-avatar").outerHTML = avatarMarkup(get().user, "app-avatar--small");
      root.querySelector(".app-side__foot .app-side__name").textContent = get().user.name;
    } else if (topic === "side") {
      const toggle = root.querySelector("[data-side-toggle]");
      toggle.setAttribute("aria-pressed", String(get().side.open));
      toggle.setAttribute("aria-label", `${get().side.open ? "Hide" : "Show"} the projects rail`);
    }
  });
  return () => off();
}
