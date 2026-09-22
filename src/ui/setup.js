// setup.js: the checklist a project runs before it runs. The list is DATA the
// server sends (one step per connector the goal needs, plus the card), so the
// page never names a service: it renders whatever arrives with the connector
// manifest's own mark, title and hint. On the sim (no server) the built-in
// three steps render exactly as they always have.
import { icon } from "../icons.js";
import { completeSetup, project, pushNotification, setSetupCurrent, setupStepDone, setupSteps, subscribe } from "../store.js";
import { EASE_STD, escapeHtml, reduceMotion, riseIn, runButton, wait } from "../util.js";
import { cardMarkup, cardWire, formSetError, saveCard } from "./card.js";

// the sim's own steps: only used when the server sent none
const LOCAL_STEPS = [
  { id: "youtube", title: "Create YouTube channel", hint: "The channel the videos post to. No API keys, just a Google sign-in.", mark: null, tier: "session" },
  { id: "card", title: "Fill in credit card information", hint: "The card the ad spend bills to.", mark: null, tier: "card" },
  { id: "stripe", title: "Stripe account setup", hint: "The account the payouts land in.", mark: null, tier: "api_key" },
];

const tierOf = (step) => step.tier || (step.id === "card" ? "card" : step.auth || (step.id === "youtube" ? "session" : "oauth2"));
// the mark a step draws: the connector manifest's own icon, or a neutral plug
const markOf = (step) => {
  if (step.id === "card") return icon("credit-card");
  if (step.mark) {
    try {
      return icon(step.mark);
    } catch {
      /* a mark the icon set lacks falls back below */
    }
  }
  return icon("external-link");
};

// what a finished setup folds to, in the thread: the server's own step list,
// so the line names the accounts the goal actually needed
export const setupDoneMarkup = (p) => {
  const steps = p.setup?.steps?.length ? p.setup.steps : setupSteps.map((id) => ({ id, title: id }));
  return `<div class="c-flow__done"><span class="c-flow__done-mark">${icon("check")}</span><span class="c-flow__done-title">All set</span><span class="c-flow__done-text">${steps.map((s) => escapeHtml(p.setup.summary?.[s.id] || s.title)).join(", ")}.</span></div>`;
};

const stepMarkup = (step) => `<div class="c-task c-task--bare" role="group" aria-label="${escapeHtml(step.title)}">
  <span class="c-task__head">${markOf(step)}<span class="c-task__title">${escapeHtml(step.hint || step.title)}</span></span>
  <button type="button" class="btn c-task__done" data-step-connect="${escapeHtml(step.id)}"><span class="btn__icon"></span><span class="btn__label">Connect</span></button>
</div>`;

const keyStepMarkup = (step) => `<form class="c-stripe" novalidate aria-label="${escapeHtml(step.title)}" data-key-step data-key-connector="${escapeHtml(step.id)}">
  <span class="c-task__head">${markOf(step)}<span class="c-task__title">${escapeHtml(step.keyHelp?.instructions || step.hint || step.title)}</span></span>
  ${step.keyHelp?.url ? `<p class="c-flow__hint"><a href="${escapeHtml(step.keyHelp.url)}" target="_blank" rel="noopener">Copy the ${escapeHtml(step.keyHelp.field || "key")} here</a>${step.keyHelp.uses ? ` — ${escapeHtml(step.keyHelp.uses)}` : ""}</p>` : ""}
  ${step.keyHelp?.screenshot ? `<img class="c-action__shot" src="${escapeHtml(step.keyHelp.screenshot)}" alt="where the key is on the page" width="360" height="200">` : ""}
  <label class="c-card__field"><span class="c-card__label">${escapeHtml(step.keyHelp?.field || "API key")}</span><input class="c-card__input" name="key" type="password" autocomplete="off" spellcheck="false" data-key-input></label>
  <p class="c-card__error" data-card-error role="alert" hidden></p>
  <button type="submit" class="btn c-stripe__connect" data-key-connect><span class="btn__icon"></span><span class="btn__label">Verify key</span></button>
</form>`;

// the session tier in the checklist: the same one-time hand-off the composer's
// popup runs, in the step body. The platform opens a tenant-isolated sign-in
// window, the person finishes in it, and Finished asks the platform to verify
// before the step is recorded. Opening the consent route in a tab would show
// the JSON it answers, which is why this tier has a body of its own.
const sessionStepMarkup = (step) => `<div class="c-stripe" data-session-step="${escapeHtml(step.id)}">
  <span class="c-task__head">${markOf(step)}<span class="c-task__title">${escapeHtml(step.hint || step.title)}</span></span>
  <p class="c-flow__hint" data-session-note>${icon("loader-circle", "c-tool__spin")} Opening a sign-in window that belongs to this account only</p>
  <button type="button" class="btn c-stripe__connect" data-session-finish disabled><span class="btn__icon"></span><span class="btn__label">Finished</span></button>
  <p class="c-card__error" data-card-error role="alert" hidden></p>
</div>`;

export function renderSetup(root, projectId) {
  const p = () => project(projectId);
  // the server's step list wins; the sim's own list is the fallback
  const steps = () => (p().setup?.steps?.length ? p().setup.steps : LOCAL_STEPS);
  const isDone = (id) => (p().setup.done || []).includes(id);
  const status = (i) => (i === p().setup.current ? "current" : isDone(steps()[i].id) ? "done" : "open");
  const allDone = () => steps().every((s) => isDone(s.id));
  const firstOpen = () => steps().findIndex((s) => !isDone(s.id));
  const answersOf = (id) => p().setup?.answers?.[id];

  const bodyFor = (step) => {
    const tier = tierOf(step);
    if (step.id === "card") return cardMarkup({ bare: true, id: "setup-card" });
    if (tier === "api_key") return keyStepMarkup(step);
    if (tier === "session") return sessionStepMarkup(step);
    return stepMarkup(step);
  };

  const row = (step, i) => {
    const st = status(i);
    const done = isDone(step.id);
    const text = `<span class="c-flow__check">${done ? icon("check") : ""}</span><span class="c-flow__row-text"><span class="c-flow__row-title">${markOf(step)} ${escapeHtml(step.title)}</span>${done ? `<span class="c-flow__summary">${icon("check")}${escapeHtml(p().setup.summary?.[step.id] || "Done")}</span>` : `<span class="c-flow__hint">${escapeHtml(step.hint || "")}</span>`}</span>`;
    const head = `<button type="button" class="c-flow__row-head" data-flow-open="${escapeHtml(step.id)}" aria-expanded="${st === "current"}">${text}${done && st !== "current" ? `<span class="c-flow__change">Change</span>` : ""}${icon("chevron-down", "c-flow__chev")}</button>`;
    return `<li class="c-flow__row is-${st}${done && st === "current" ? " is-redo" : ""}"${st === "current" ? ' aria-current="step"' : ""}${step.id === "card" ? ' data-flow-card="1"' : ` data-flow-connector="${escapeHtml(step.id)}"`}>${head}${st === "current" ? `<div class="c-flow__body" data-flow-step="${escapeHtml(step.id)}">${bodyFor(step)}</div>` : ""}</li>`;
  };

  const stageMarkup = () => `<ol class="c-flow__list" aria-label="Steps">${steps().map(row).join("")}</ol>`;

  root.innerHTML = `<div class="c-flow panel app-flow" id="flow">
  <div class="c-flow__head"><span class="c-flow__title">Setup</span><span class="c-flow__count" data-flow-count></span></div>
  <div class="c-flow__stage" data-flow-stage></div>
</div>`;
  const stage = root.querySelector("[data-flow-stage]");

  function paint({ animate = true } = {}) {
    root.querySelector("[data-flow-count]").textContent = `${steps().filter((s) => isDone(s.id)).length} of ${steps().length} done`;
    stage.innerHTML = stageMarkup();
    wire();
    if (animate) riseIn(stage.querySelector("[data-flow-step]"), { duration: 220, y: 6 });
  }

  async function stepDone(id, summary, answers = {}) {
    const leaving = stage.querySelector(`[data-flow-step="${id}"]`);
    await wait(700);
    if (leaving && !reduceMotion()) await leaving.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: EASE_STD, fill: "forwards" }).finished;
    setupStepDone(projectId, id, summary, answers);
    paint();
    if (allDone()) {
      pushNotification("upload", `${p().name}: setup complete`, { projectId });
      await wait(600);
      completeSetup(projectId);
    }
  }

  // the key tier finishes through the server: it probes the key before it
  // keeps it, so a bad paste is a sentence, not a stored dud
  async function connectKey(form) {
    const button = form.querySelector("[data-key-connect]");
    if (button.dataset.busy) return;
    const input = form.querySelector("[data-key-input]");
    const key = input.value.trim();
    if (!key) return formSetError(form, "Paste the key first.", input);
    formSetError(form, "");
    button.dataset.busy = "1";
    await runButton(button, { busy: "Verifying", work: 400, keep: true });
    let out = null;
    try {
      const res = await fetch(`/api/connect/${encodeURIComponent(form.dataset.keyConnector)}/key`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": document.cookie.match(/(?:^|;\s*)img_csrf=([^;]+)/)?.[1] || "" },
        body: JSON.stringify({ key, projectId }),
      });
      out = await res.json().catch(() => null);
      if (!res.ok || !out?.ok) {
        delete button.dataset.busy;
        button.classList.remove("is-busy");
        return formSetError(form, out?.error || "That key did not verify. Copy it again.", input);
      }
    } catch {
      delete button.dataset.busy;
      button.classList.remove("is-busy");
      return formSetError(form, "Could not reach the verifier. Try again.", input);
    }
    pushNotification("upload", `${form.dataset.keyConnector} connected`, { projectId });
    stepDone(form.dataset.keyConnector, out.account?.name ? `Connected as ${out.account.name}` : "Key verified", { verified: true });
  }

  // the session tier: the platform opens a tenant-isolated window, the person
  // signs in inside it, and Finished makes the platform verify before the step
  // is recorded. A refused sign-in is a sentence, never a stored dud.
  async function connectSession(el) {
    const id = el.dataset.sessionStep;
    const button = el.querySelector("[data-session-finish]");
    const note = el.querySelector("[data-session-note]");
    const error = el.querySelector("[data-card-error]");
    const post = (action) =>
      fetch(`/api/connect/${encodeURIComponent(id)}/session`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": document.cookie.match(/(?:^|;\s*)img_csrf=([^;]+)/)?.[1] || "" },
        body: JSON.stringify({ action, projectId }),
      }).then((r) => r.json().catch(() => null));
    let opened;
    try {
      opened = await post("open");
      if (!opened?.ok) throw new Error(opened?.error || "the sign-in window did not open");
    } catch (err) {
      error.hidden = false;
      error.textContent = String(err?.message || err);
      return;
    }
    note.innerHTML = `Sign in inside the window. Only the session is kept, never the password. <a href="${escapeHtml(opened.url || "#")}" target="_blank" rel="noopener">Open it in a tab instead</a>`;
    button.disabled = false;
    button.addEventListener("click", async () => {
      if (button.dataset.busy) return;
      button.dataset.busy = "1";
      button.disabled = true;
      await runButton(button, { busy: "Verifying", work: 400, keep: true });
      let out = null;
      try {
        out = await post("finish");
        if (!out?.ok) throw new Error(out?.error || "the sign-in did not complete");
      } catch (err) {
        delete button.dataset.busy;
        button.disabled = false;
        button.classList.remove("is-busy");
        error.hidden = false;
        error.textContent = String(err?.message || err);
        return;
      }
      pushNotification("upload", `${id} connected`, { projectId });
      stepDone(id, out.account?.name ? `Connected as ${out.account.name}` : "Signed in");
    });
  }

  function wire() {
    for (const head of stage.querySelectorAll("[data-flow-open]")) {
      head.addEventListener("click", () => {
        const i = steps().findIndex((s) => s.id === head.dataset.flowOpen);
        setSetupCurrent(projectId, p().setup.current === i ? (isDone(head.dataset.flowOpen) ? firstOpen() : -1) : i);
        paint();
        stage.querySelector(`[data-flow-open="${head.dataset.flowOpen}"]`)?.focus();
      });
    }
    // a connector step opens its own connect flow: the consent tab for oauth2,
    // the hand-off window for a session, and the field above for a key
    for (const btn of stage.querySelectorAll("[data-step-connect]")) {
      btn.addEventListener("click", () => {
        const id = btn.dataset.stepConnect;
        const url = `/api/connect/${encodeURIComponent(id)}/start?project=${encodeURIComponent(projectId)}`;
        window.open(url, "_blank", "noopener");
      });
    }
    const keyForm = stage.querySelector("[data-key-step]");
    if (keyForm) {
      keyForm.addEventListener("submit", (e) => {
        e.preventDefault();
        connectKey(keyForm);
      });
    }
    const sessionStep = stage.querySelector("[data-session-step]");
    if (sessionStep) connectSession(sessionStep);
    const form = stage.querySelector("#setup-card");
    if (form) {
      cardWire(form);
      const before = answersOf("card");
      if (before?.holder) form.querySelector("[data-card-name]").value = before.holder;
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const card = await saveCard(form);
        if (!card) return;
        pushNotification("upload", `${card.brand} ending ${card.last4} saved`, { projectId });
        stepDone("card", `${card.brand} ending ${card.last4}`, { holder: card.holder, brand: card.brand, last4: card.last4 });
      });
    }
  }

  paint({ animate: false });
  const off = subscribe((topic, payload) => {
    // the server owns the steps in live mode: a thread or setup change repaints
    if ((topic === "setup" || topic === "thread") && payload?.id === projectId && root.isConnected) paint({ animate: false });
    if (topic === "setup" && payload?.id === projectId && !root.isConnected) off();
  });
  return () => off();
}