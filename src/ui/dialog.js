// dialog.js: the app's one modal shape, a native <dialog> on the panel
// language, and the forms that use it: confirm, rename, new project,
// keyboard shortcuts.
import { icon } from "../icons.js";
import { MOD, escapeHtml, reduceMotion, wait } from "../util.js";

// opens a dialog with the given body; resolves with whatever close() is
// handed. Escape, the backdrop and any [data-close] control close with null
export function openDialog(body, { label, onOpen } = {}) {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.className = "app-dialog panel";
    dialog.setAttribute("aria-label", label);
    dialog.innerHTML = body;
    document.body.append(dialog);
    let settled = false;
    const close = async (value = null) => {
      if (settled) return;
      settled = true;
      if (!reduceMotion()) {
        await dialog.animate([{ opacity: 1, transform: "translateY(0) scale(1)" }, { opacity: 0, transform: "translateY(6px) scale(0.98)" }], { duration: 150, easing: "cubic-bezier(0.2, 0, 0, 1)" }).finished;
      }
      dialog.close();
      dialog.remove();
      resolve(value);
    };
    dialog.addEventListener("cancel", (e) => {
      e.preventDefault();
      close(null);
    });
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog) return close(null);
      if (e.target.closest("[data-close]")) close(null);
    });
    dialog.showModal();
    if (!reduceMotion()) dialog.animate([{ opacity: 0, transform: "translateY(8px) scale(0.98)" }, { opacity: 1, transform: "translateY(0) scale(1)" }], { duration: 220, easing: "cubic-bezier(0.05, 0.7, 0.1, 1)" });
    onOpen?.(dialog, close);
  });
}

const head = (title, text) => `<div class="app-dialog__head"><h2 class="app-dialog__title">${escapeHtml(title)}</h2>${text ? `<p class="app-dialog__text">${escapeHtml(text)}</p>` : ""}<button type="button" class="btn btn--icon btn--quiet app-dialog__x" aria-label="Close" data-close>${icon("x")}</button></div>`;

export function confirmDialog({ title, text, action = "Continue", danger = false }) {
  return openDialog(
    `${head(title, text)}<div class="app-dialog__foot"><button type="button" class="btn" data-close>Cancel</button><button type="button" class="btn${danger ? " btn--danger" : " btn--primary"}" data-ok>${escapeHtml(action)}</button></div>`,
    {
      label: title,
      onOpen: (dialog, close) => {
        const ok = dialog.querySelector("[data-ok]");
        ok.focus();
        ok.addEventListener("click", () => close(true));
      },
    },
  ).then(Boolean);
}

// a generated artifact stands up and plays right here: the clip a
// "Clip Generated" card stands for, the voiceover, the image
export function mediaDialog(src, title = "What the agent made") {
  const ext = String(src).split(".").pop().toLowerCase();
  const body = ext === "mp4" || ext === "webm"
    ? `<video class="app-dialog__media" src="${escapeHtml(src)}" controls autoplay></video>`
    : ext === "mp3" || ext === "wav"
      ? `<audio class="app-dialog__media" src="${escapeHtml(src)}" controls autoplay></audio>`
      : `<img class="app-dialog__media" src="${escapeHtml(src)}" alt="${escapeHtml(title)}">`;
  return openDialog(`${head(title)}<div class="app-dialog__media-wrap">${body}</div>`, {
    label: title,
    onOpen: (dialog) => {
      dialog.addEventListener("close", () => {
        const media = dialog.querySelector("video, audio");
        if (media) media.pause();
      });
    },
  });
}

export function renameDialog(current) {
  return openDialog(
    `${head("Rename project")}<form class="app-dialog__form" data-form><label class="c-card__field"><span class="c-card__label">Name</span><input class="c-card__input" name="name" value="${escapeHtml(current)}" maxlength="60" autocomplete="off" required></label><div class="app-dialog__foot"><button type="button" class="btn" data-close>Cancel</button><button type="submit" class="btn btn--primary">Save name</button></div></form>`,
    {
      label: "Rename project",
      onOpen: (dialog, close) => {
        const input = dialog.querySelector("input");
        input.focus();
        input.select();
        dialog.querySelector("[data-form]").addEventListener("submit", (e) => {
          e.preventDefault();
          const name = input.value.trim();
          if (name) close(name);
          else input.focus();
        });
      },
    },
  );
}

const SHORTCUTS = [
  ["Search projects and pages", `${MOD} K`],
  ["Go home", "G then H"],
  ["Open settings", "G then S"],
  ["Open activity", "G then A"],
  ["Show or hide the projects rail", `${MOD} B`],
  ["Send a message", "Enter"],
  ["New line in a message", "Shift Enter"],
  ["Answer a question", "1 to 9, then Enter"],
  ["Submit a question form", `${MOD} Enter`],
  ["Close a menu or form", "Esc"],
  ["Read the graph", "Tab in, then arrows"],
];

export function shortcutsDialog() {
  return openDialog(
    `${head("Keyboard shortcuts")}<dl class="app-keys">${SHORTCUTS.map(([what, keys]) => `<div class="app-keys__row"><dt>${what}</dt><dd>${keys.split(" ").map((k) => `<kbd>${k}</kbd>`).join(" ")}</dd></div>`).join("")}</dl>`,
    { label: "Keyboard shortcuts", onOpen: (dialog) => dialog.querySelector("[data-close]").focus() },
  );
}

// a short pause so a dialog's close animation finishes before the next thing moves
export const settle = () => wait(reduceMotion() ? 0 : 160);
