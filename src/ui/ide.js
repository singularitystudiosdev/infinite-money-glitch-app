// ide.js: the workspace the agent writes into, as the rail's Files card:
// what is there, how big it is, and a viewer for one file's content.
import { icon } from "../icons.js";
import { project, subscribe } from "../store.js";
import { fetchFile } from "../live.js";
import { openDialog } from "./dialog.js";
import { escapeHtml } from "../util.js";

// bytes read the SI way, as the rest of the app writes them: 512 B,
// 1.2 kB, 23 kB
function formatBytes(n) {
  if (!Number.isFinite(n)) return "";
  const units = ["B", "kB", "MB", "GB"];
  let v = n;
  let i = 0;
  while (v >= 1000 && i < units.length - 1) {
    v /= 1000;
    i++;
  }
  return `${i && v < 10 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}

// the viewer renders a file's head and says how much it did not show
const VIEW_LINES = 2000;

// a file row: the path as the name, the size quiet at the right, the whole
// row a button so it reads as clickable
const fileRow = (f) => `<li role="listitem"><button type="button" class="app-files__row" data-file="${escapeHtml(f.path)}" title="${escapeHtml(f.path)}"><span class="app-files__name">${escapeHtml(f.path)}</span><span class="app-files__size">${formatBytes(f.size)}</span></button></li>`;

// the file viewer, on the app's one dialog shape: the path as the title,
// a quiet Reading line until the content lands, then the file in a mono
// pre, long files scrolled and capped with a muted more-lines tail
function openFile(file, projectId) {
  openDialog(
    `<div class="app-dialog__head"><h2 class="app-dialog__title">${escapeHtml(file.path)}</h2><p class="app-dialog__text" data-file-meta>Reading…</p><button type="button" class="btn btn--icon btn--quiet app-dialog__x" aria-label="Close" data-close>${icon("x")}</button></div><div class="app-fileview__body"><span class="app-fileview__loading" data-file-loading>${icon("loader-circle", "btn__spinner")}Reading</span><pre class="app-fileview__pre" data-file-pre hidden><code data-file-code></code></pre><p class="app-fileview__more" data-file-more hidden></p></div>`,
    {
      label: file.path,
      onOpen: async (dialog) => {
        let content;
        try {
          content = await fetchFile(projectId, file.path);
        } catch {
          if (!dialog.isConnected) return;
          dialog.querySelector("[data-file-loading]").textContent = "Could not read this file.";
          return;
        }
        if (!dialog.isConnected) return;
        const lines = String(content ?? "").split("\n");
        dialog.querySelector("[data-file-code]").textContent = lines.slice(0, VIEW_LINES).join("\n");
        const more = dialog.querySelector("[data-file-more]");
        more.hidden = lines.length <= VIEW_LINES;
        if (!more.hidden) more.textContent = `… ${lines.length - VIEW_LINES} more lines`;
        dialog.querySelector("[data-file-meta]").textContent = `${lines.length} lines · ${formatBytes(file.size)}`;
        dialog.querySelector("[data-file-loading]").hidden = true;
        dialog.querySelector("[data-file-pre]").hidden = false;
      },
    },
  );
}

export function renderFiles(root, projectId) {
  const p = () => project(projectId);
  root.innerHTML = `<section class="panel app-files" aria-label="Files">
  <div class="app-files__head"><span class="c-dash__heading"><span class="c-dash__title">Files</span><span class="c-dash__meta" data-files-count></span></span></div>
  <ul class="app-files__list" data-files-list role="list"></ul>
  <div class="app-files__none" data-files-none hidden><span class="app-files__none-title">No files yet</span><span class="app-files__none-sub">Files the agent writes land here</span></div>
</section>`;

  function paint() {
    const files = p().files || [];
    root.querySelector("[data-files-list]").innerHTML = files.map(fileRow).join("");
    root.querySelector("[data-files-none]").hidden = files.length > 0;
    root.querySelector("[data-files-count]").textContent = files.length ? `${files.length}` : "";
  }

  root.addEventListener("click", (e) => {
    const row = e.target.closest("[data-file]");
    if (!row) return;
    const file = (p().files || []).find((f) => f.path === row.dataset.file);
    if (file) openFile(file, projectId);
  });

  paint();
  const off = subscribe((topic, payload) => {
    if (!root.isConnected) return;
    // the workspace's file list rides the project's live updates
    if (topic === "projects" && payload.changed === projectId) paint();
  });
  return off;
}
