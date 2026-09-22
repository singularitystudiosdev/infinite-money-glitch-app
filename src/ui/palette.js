// palette.js: Cmd/Ctrl K. One field, one list: projects, pages and actions,
// narrowed as you type; arrows move, Enter opens, Escape closes.
import { icon } from "../icons.js";
import { navigate, projectPath } from "../router.js";
import { get } from "../store.js";
import { escapeHtml, reduceMotion } from "../util.js";
import { openDialog } from "./dialog.js";

let actions = {};
let open = false;

export function setPaletteActions(next) {
  actions = next;
}

function entries() {
  const list = [];
  for (const p of get().projects.filter((x) => !x.draft)) list.push({ group: "Projects", icon: "folder-open", label: p.name, hint: p.thoughts[p.step], run: () => navigate(projectPath(p.id)) });
  list.push(
    { group: "Pages", icon: "house", label: "Home", hint: "Every project", run: () => navigate("/") },
    { group: "Pages", icon: "play", label: "Demos", hint: "Every goal the demo can play", run: () => actions.demos?.() },
    { group: "Pages", icon: "inbox", label: "Activity", hint: "Everything that happened", run: () => navigate("/activity") },
    { group: "Pages", icon: "user", label: "Settings: Account", run: () => navigate("/settings/account") },
    { group: "Pages", icon: "coins", label: "Settings: Credits", hint: `${get().credits.balance.toLocaleString("en-US")} left`, run: () => navigate("/settings/credits") },
    { group: "Pages", icon: "credit-card", label: "Settings: Billing", run: () => navigate("/settings/billing") },
    { group: "Actions", icon: "plus", label: "New project", run: () => actions.newProject?.() },
    { group: "Actions", icon: "keyboard", label: "Keyboard shortcuts", run: () => actions.shortcuts?.() },
    { group: "Actions", icon: "layout-grid", label: "Component gallery", run: () => (location.href = "gallery.html") },
  );
  return list;
}

function matches(entry, q) {
  if (!q) return true;
  const hay = `${entry.label} ${entry.hint || ""} ${entry.group}`.toLowerCase();
  return q.split(/\s+/).every((word) => hay.includes(word));
}

function rowsMarkup(list, q) {
  let group = "";
  return list
    .map((e, i) => {
      const heading = e.group !== group ? `<span class="c-menu__label" role="presentation">${e.group}</span>` : "";
      group = e.group;
      return `${heading}<button type="button" class="c-menu__item app-palette__row" role="option" aria-selected="${i === 0}" data-index="${i}">${icon(e.icon)}<span class="c-menu__text">${escapeHtml(e.label)}</span>${e.hint ? `<span class="c-menu__hint app-palette__hint">${escapeHtml(e.hint)}</span>` : ""}</button>`;
    })
    .join("") || `<div class="app-palette__empty"><span>Nothing matches "${escapeHtml(q)}".</span><button type="button" class="btn btn--quiet" data-clear>Clear the search</button></div>`;
}

export function openPalette() {
  if (open) return;
  open = true;
  const all = entries();
  let shown = all;
  let selected = 0;
  openDialog(
    `<div class="app-palette"><label class="app-palette__field">${icon("search")}<input class="app-palette__input" type="text" placeholder="Search projects, pages and actions" aria-label="Search" autocomplete="off" spellcheck="false"></label><div class="app-palette__list" role="listbox" aria-label="Results"></div><div class="app-palette__foot"><span><kbd>↑</kbd> <kbd>↓</kbd> move</span><span><kbd>Enter</kbd> open</span><span><kbd>Esc</kbd> close</span></div></div>`,
    {
      label: "Search",
      onOpen: (dialog, close) => {
        dialog.classList.add("app-dialog--palette");
        const input = dialog.querySelector("input");
        const list = dialog.querySelector("[role=listbox]");
        const paint = () => {
          const q = input.value.trim().toLowerCase();
          shown = all.filter((e) => matches(e, q));
          selected = 0;
          list.innerHTML = rowsMarkup(shown, input.value.trim());
        };
        const select = (i) => {
          selected = (i + shown.length) % shown.length;
          for (const row of list.querySelectorAll("[data-index]")) {
            const on = Number(row.dataset.index) === selected;
            row.setAttribute("aria-selected", String(on));
            if (on) row.scrollIntoView({ block: "nearest", behavior: reduceMotion() ? "auto" : "smooth" });
          }
        };
        const run = (i) => {
          const entry = shown[i];
          if (!entry) return;
          close(true);
          entry.run();
        };
        paint();
        input.focus();
        input.addEventListener("input", paint);
        dialog.addEventListener("keydown", (e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            select(selected + 1);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            select(selected - 1);
          } else if (e.key === "Enter") {
            e.preventDefault();
            run(selected);
          }
        });
        list.addEventListener("click", (e) => {
          if (e.target.closest("[data-clear]")) {
            input.value = "";
            paint();
            input.focus();
            return;
          }
          const row = e.target.closest("[data-index]");
          if (row) run(Number(row.dataset.index));
        });
        list.addEventListener("pointermove", (e) => {
          const row = e.target.closest("[data-index]");
          if (row && Number(row.dataset.index) !== selected) select(Number(row.dataset.index));
        });
      },
    },
  ).then(() => (open = false));
}
