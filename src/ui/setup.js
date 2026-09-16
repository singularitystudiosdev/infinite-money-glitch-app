// setup.js: the checklist a project runs before it runs: create the
// YouTube channel, fill in the card, connect Stripe. Open any step in any
// order; a finished one folds to what it recorded, and All set hands the
// panel over to the dashboard.
import { STRIPE_MARK, YOUTUBE_MARK, icon } from "../icons.js";
import { completeSetup, project, pushNotification, setSetupCurrent, setupStepDone, setupSteps, subscribe } from "../store.js";

// what a finished setup folds to, in the thread
export const setupDoneMarkup = (p) => `<div class="c-flow__done"><span class="c-flow__done-mark">${icon("check")}</span><span class="c-flow__done-title">All set</span><span class="c-flow__done-text">${setupSteps.map((s) => escapeHtml(p.setup.summary[s] || s)).join(", ")}.</span></div>`;
import { EASE_STD, escapeHtml, reduceMotion, riseIn, runButton, wait } from "../util.js";
import { cardMarkup, cardWire, formSetError, saveCard } from "./card.js";

const STRIPE_COUNTRIES = ["United States", "United Kingdom", "Canada", "Australia", "Germany", "France", "Netherlands", "Sweden", "Indonesia"];

// a step's body takes the answers it was finished with, if any, so a step
// opened again to change its answer starts from what was entered
const taskMarkup = (answers) => `<div class="c-task c-task--bare" role="group" aria-label="Create YouTube channel">
  <span class="c-task__head">${YOUTUBE_MARK}<span class="c-task__title">${answers ? "Channel verified. Sign in again to use a different one" : "Sign in to a Google account and create the channel"}</span></span>
  <button type="button" class="btn c-task__done" data-task-complete><span class="btn__icon"></span><span class="btn__label">${answers ? "Verify again" : "Complete"}</span></button>
</div>`;

const YOUTUBE_URL = "https://www.youtube.com/create_channel";

const stripeMarkup = (answers) => `<form class="c-stripe" novalidate aria-label="Stripe account setup" data-stripe>
  <span class="c-task__head">${STRIPE_MARK}<span class="c-task__title">Connect the Stripe account the payouts land in</span></span>
  <label class="c-card__field"><span class="c-card__label">Business email</span><input class="c-card__input" name="business-email" type="email" autocomplete="email" placeholder="you@company.com" value="${escapeHtml(answers?.email || "")}" data-stripe-email></label>
  <label class="c-card__field"><span class="c-card__label">Country</span><span class="c-stripe__pick"><select class="c-card__input c-stripe__select" name="country" data-stripe-country>${STRIPE_COUNTRIES.map((c) => `<option value="${c}"${c === answers?.country ? " selected" : ""}>${c}</option>`).join("")}</select>${icon("chevron-down", "c-stripe__chev")}</span></label>
  <p class="c-card__error" data-card-error role="alert" hidden></p>
  <button type="submit" class="btn c-stripe__connect" data-stripe-connect><span class="btn__icon"></span><span class="btn__label">Connect with Stripe</span></button>
</form>`;

const STEPS = [
  { id: "youtube", title: "Create YouTube channel", hint: "The channel the videos post to. No API keys, just a Google sign-in.", body: taskMarkup },
  { id: "card", title: "Fill in credit card information", hint: "The card the ad spend bills to.", body: () => cardMarkup({ bare: true, id: "setup-card" }) },
  { id: "stripe", title: "Stripe account setup", hint: "The account the payouts land in.", body: stripeMarkup },
];

export function renderSetup(root, projectId) {
  const p = () => project(projectId);
  const isDone = (i) => p().setup.done.includes(STEPS[i].id);
  // the open step comes first: a finished step opened again to change its
  // answer shows its form with the summary still on the row
  const status = (i) => (i === p().setup.current ? "current" : isDone(i) ? "done" : "open");
  const allDone = () => p().setup.done.length === setupSteps.length;
  const firstOpen = () => STEPS.findIndex((s) => !p().setup.done.includes(s.id));
  const answersOf = (id) => p().setup.answers?.[id];

  const row = (step, i) => {
    const st = status(i);
    const done = isDone(i);
    const text = `<span class="c-flow__check">${done ? icon("check") : ""}</span><span class="c-flow__row-text"><span class="c-flow__row-title">${step.title}</span>${done ? `<span class="c-flow__summary">${icon("check")}${escapeHtml(p().setup.summary[step.id] || "Done")}</span>` : `<span class="c-flow__hint">${step.hint}</span>`}</span>`;
    // a finished row opens too: Change on its right, then the form
    const head = `<button type="button" class="c-flow__row-head" data-flow-open="${step.id}" aria-expanded="${st === "current"}">${text}${done && st !== "current" ? `<span class="c-flow__change">Change</span>` : ""}${icon("chevron-down", "c-flow__chev")}</button>`;
    return `<li class="c-flow__row is-${st}${done && st === "current" ? " is-redo" : ""}"${st === "current" ? ' aria-current="step"' : ""}>${head}${st === "current" ? `<div class="c-flow__body" data-flow-step="${step.id}">${step.body(done ? answersOf(step.id) || {} : undefined)}</div>` : ""}</li>`;
  };

  const stageMarkup = () => `<ol class="c-flow__list" aria-label="Steps">${STEPS.map(row).join("")}</ol>`;

  root.innerHTML = `<div class="c-flow panel app-flow" id="flow">
  <div class="c-flow__head"><span class="c-flow__title">Setup</span><span class="c-flow__count" data-flow-count></span></div>
  <div class="c-flow__stage" data-flow-stage></div>
</div>`;
  const stage = root.querySelector("[data-flow-stage]");

  function paint({ animate = true } = {}) {
    root.querySelector("[data-flow-count]").textContent = `${p().setup.done.length} of ${setupSteps.length} done`;
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
    // the last step lands: the project is set up, and the chat takes over
    if (allDone()) {
      pushNotification("upload", `${p().name}: setup complete`, { projectId });
      await wait(600);
      completeSetup(projectId);
    }
  }

  // Complete opens YouTube in a new tab (from the click, so the browser
  // allows it), then runs the verify-then-done shape here
  async function completeTask(button) {
    const card = button.closest(".c-task");
    if (card.classList.contains("is-done") || button.dataset.busy) return;
    window.open(YOUTUBE_URL, "_blank", "noopener");
    card.classList.add("is-verifying");
    const ran = await runButton(button, { busy: "Verifying", done: "Done", work: 2200, keep: true });
    if (!ran) return;
    card.classList.remove("is-verifying");
    card.classList.add("is-done");
    pushNotification("upload", "YouTube channel verified", { projectId });
    stepDone("youtube", "Channel verified", { verified: true });
  }

  async function connectStripe(form) {
    const button = form.querySelector("[data-stripe-connect]");
    if (form.classList.contains("is-connected") || button.dataset.busy) return;
    const email = form.querySelector("[data-stripe-email]");
    const country = form.querySelector("[data-stripe-country]").value;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) return formSetError(form, "Enter the email the Stripe account uses.", email);
    formSetError(form, "");
    form.classList.add("is-connecting");
    await runButton(button, { busy: "Connecting", done: "Connected", work: 1500, keep: true });
    form.classList.remove("is-connecting");
    form.classList.add("is-connected");
    email.readOnly = true;
    form.querySelector("[data-stripe-country]").disabled = true;
    pushNotification("upload", `Stripe connected, payouts to ${email.value.trim()}`, { projectId });
    stepDone("stripe", `Stripe, ${email.value.trim()}, ${country}`, { email: email.value.trim(), country });
  }

  function wire() {
    for (const head of stage.querySelectorAll("[data-flow-open]")) {
      head.addEventListener("click", () => {
        const i = STEPS.findIndex((s) => s.id === head.dataset.flowOpen);
        // folding a finished step you opened goes back to the first open
        // step; folding an open one closes the list
        setSetupCurrent(projectId, p().setup.current === i ? (isDone(i) ? firstOpen() : -1) : i);
        paint();
        stage.querySelector(`[data-flow-open="${head.dataset.flowOpen}"]`)?.focus();
      });
    }
    stage.querySelector("[data-task-complete]")?.addEventListener("click", (e) => completeTask(e.currentTarget));
    const form = stage.querySelector("#setup-card");
    if (form) {
      cardWire(form);
      // a card entered before: the name comes back, the number is typed anew
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
    const stripe = stage.querySelector("[data-stripe]");
    if (stripe) {
      stripe.querySelector("[data-stripe-email]").addEventListener("input", () => formSetError(stripe, ""));
      stripe.addEventListener("submit", (e) => {
        e.preventDefault();
        connectStripe(stripe);
      });
    }
  }

  paint({ animate: false });
  const off = subscribe((topic, payload) => {
    if (topic === "setup" && payload?.id === projectId && !root.isConnected) off();
  });
  return () => off();
}
