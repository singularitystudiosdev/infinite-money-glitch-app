// demos.js: the demo list (#/demos). Every goal the player can play, one
// row each: the request the user would type, what the agent did with it,
// and the link that plays it. The list is read from demo/scripts/index.js,
// so a new demo appears here the moment it is registered — this page has no
// list of its own to maintain.
import { demoList } from "../demo/scripts/index.js";
import { icon } from "../icons.js";
import { projectPath } from "../router.js";
import { escapeHtml } from "../util.js";

const row = (d) => `<a class="demo-row panel" href="#${projectPath(d.id)}" data-demo-row="${escapeHtml(d.id)}">
  <span class="demo-row__play">${icon("play")}</span>
  <span class="demo-row__body">
    <span class="demo-row__title">${escapeHtml(d.title)}</span>
    <span class="demo-row__request">${escapeHtml(d.request)}</span>
  </span>
  <span class="demo-row__go">${icon("arrow-up-right")}</span>
</a>`;

export function render(root) {
  const demos = demoList();
  root.innerHTML = `<section class="app-home app-demos">
  <div class="c-dash panel app-dash">
    <div class="c-dash__head">
      <span class="c-dash__heading"><span class="c-dash__title">Demos</span><span class="c-dash__meta">${demos.length} goals</span></span>
      <span class="app-home__tools"><a class="btn btn--icon" href="#/" aria-label="Back">${icon("arrow-left")}</a></span>
    </div>
    <div class="app-demos__list" role="list">${demos.map(row).join("")}</div>
  </div>
</section>`;
  return () => {};
}