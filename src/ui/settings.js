// settings.js: the sections down the left, the open one at the right.
// Account, Credits (the frame) and Billing, every control wired to the store.
import { CREDITS_LOW, CREDIT_PACKS } from "../data.js";
import { icon } from "../icons.js";
import { navigate } from "../router.js";
import { CREDITS_PER_DOLLAR, addCredits, endSession, get, packById, projects, pushNotification, resetAll, setBuying, setCard, setOther, setPack, setTopUp, setUser, subscribe } from "../store.js";
import { EASE_STD, announce, downloadText, escapeHtml, formatNum, odometerTo, reduceMotion, riseIn, runButton, shortDate } from "../util.js";
import { avatarInner, squareImage } from "./avatar.js";
import { cardMarkup, cardWire, saveCard } from "./card.js";
import { confirmDialog, openDialog, settle } from "./dialog.js";

export const SECTIONS = [
  { id: "account", label: "Account", icon: "user" },
  { id: "credits", label: "Credits", icon: "coins" },
  { id: "billing", label: "Billing", icon: "credit-card" },
];

const packRow = (p, on) => `<label class="c-settings__pack${on ? " is-selected" : ""}"><input type="radio" name="credit-pack" value="${p.id}" class="sr-only" data-credit-pack${on ? " checked" : ""}><span class="c-settings__radio"></span><span class="c-settings__pack-body"><span class="c-settings__pack-credits">${formatNum(p.credits)} credits</span>${p.note ? `<span class="c-settings__pack-note">${p.note}</span>` : ""}</span><span class="c-settings__pack-price">$${p.price}</span></label>`;

// ---------- credits ----------

function creditsDaysLeft() {
  const c = get().credits;
  return Math.max(0, Math.floor(c.balance / Math.max(1, c.spentToday)));
}

function creditsUsageText() {
  const c = get().credits;
  const days = creditsDaysLeft();
  const n = projects().length;
  if (c.balance <= 0) return `Out of credits. The ${n} projects are paused until more land.`;
  if (days < 3) return `About ${c.spentToday} spent today across ${n} projects. Running low: about ${days === 0 ? "a day" : `${days} days`} left at this rate.`;
  return `About ${c.spentToday} spent today across ${n} projects. At this rate the balance lasts about ${days} days.`;
}

// the fourth row: any amount, typed, at the small pack's rate
const otherRow = (c) => {
  const on = c.pack === "other";
  const amount = c.other || "";
  return `<label class="c-settings__pack c-settings__pack--other${on ? " is-selected" : ""}"><input type="radio" name="credit-pack" value="other" class="sr-only" data-credit-pack${on ? " checked" : ""}><span class="c-settings__radio"></span><span class="c-settings__pack-body"><span class="c-settings__pack-credits">Other</span><span class="c-settings__pack-note" data-other-credits>${amount ? `${formatNum(amount * CREDITS_PER_DOLLAR)} credits` : `${formatNum(CREDITS_PER_DOLLAR)} credits per $1`}</span></span><span class="c-settings__pack-price">$<input type="number" class="c-settings__other" data-other-amount inputmode="numeric" min="1" max="1000" step="1" placeholder="0" value="${amount}" aria-label="Amount in dollars"></span></label>`;
};

function creditsMarkup() {
  const c = get().credits;
  return `<div class="c-settings__section" data-settings-body="credits">
  <h3 class="c-settings__h">Credits</h3>
  <div class="c-settings__balance" role="group" aria-label="Credit balance">
    <span class="c-settings__balance-label">Balance</span>
    <span class="c-settings__balance-row"><span class="c-settings__balance-value" data-credits-balance>${formatNum(c.balance)}</span><span class="c-settings__balance-unit">credits</span></span>
    <span class="c-settings__bar" aria-hidden="true"><span class="c-settings__bar-fill" data-credits-bar style="transform: scaleX(${Math.min(1, c.balance / c.lastPack).toFixed(3)})"></span></span>
    <span class="c-settings__usage" data-credits-usage>${creditsUsageText()}</span>
  </div>
  <div class="c-settings__packs" role="radiogroup" aria-label="Credit pack">${CREDIT_PACKS.map((p) => packRow(p, p.id === c.pack)).join("")}${otherRow(c)}</div>
  <label class="c-settings__toggle"><input type="checkbox" class="c-settings__check" data-credits-topup${c.topUp ? " checked" : ""}><span>Top up ${formatNum(CREDIT_PACKS[0].credits)} credits on their own when the balance falls under ${formatNum(CREDITS_LOW)}</span></label>
  <button type="button" class="btn c-settings__buy" data-credits-buy><span class="btn__icon"></span><span class="btn__label">Buy credits</span></button>
</div>`;
}

function wireCredits(stage, subs) {
  const paint = ({ from = null } = {}) => {
    const c = get().credits;
    const value = stage.querySelector("[data-credits-balance]");
    if (!value) return;
    if (from === null) value.textContent = formatNum(c.balance);
    else odometerTo(value, c.balance, { from, duration: 900 });
    stage.querySelector("[data-credits-bar]").style.transform = `scaleX(${Math.min(1, c.balance / c.lastPack).toFixed(3)})`;
    stage.querySelector("[data-credits-usage]").textContent = creditsUsageText();
    stage.closest(".c-settings").classList.toggle("is-low", c.balance < CREDITS_LOW);
  };
  const select = (radio) => {
    setPack(radio.value);
    for (const row of stage.querySelectorAll(".c-settings__pack")) row.classList.toggle("is-selected", row.contains(radio));
  };
  for (const radio of stage.querySelectorAll("[data-credit-pack]")) radio.addEventListener("change", () => select(radio));
  // typing an amount picks the other row and says what it buys
  const other = stage.querySelector("[data-other-amount]");
  const otherRadio = stage.querySelector("[data-credit-pack][value=other]");
  const paintOther = () => {
    const price = Math.max(0, Math.round(Number(other.value) || 0));
    stage.querySelector("[data-other-credits]").textContent = price ? `${formatNum(price * CREDITS_PER_DOLLAR)} credits` : `${formatNum(CREDITS_PER_DOLLAR)} credits per $1`;
  };
  other.addEventListener("focus", () => {
    if (!otherRadio.checked) {
      otherRadio.checked = true;
      select(otherRadio);
    }
  });
  // pressing anywhere on the row puts you in the amount box at once
  other.closest(".c-settings__pack").addEventListener("click", () => other.focus({ preventScroll: true }));
  other.addEventListener("input", () => {
    setOther(other.value);
    paintOther();
    if (!otherRadio.checked) {
      otherRadio.checked = true;
      select(otherRadio);
    }
  });
  stage.querySelector("[data-credits-topup]").addEventListener("change", (e) => {
    setTopUp(e.target.checked);
    announce(e.target.checked ? "Top-up on" : "Top-up off");
  });
  stage.querySelector("[data-credits-buy]").addEventListener("click", async (e) => {
    const button = e.currentTarget;
    if (get().credits.buying) return;
    const pack = packById(get().credits.pack);
    if (pack.id === "other" && pack.price < 1) {
      other.focus();
      announce("Enter an amount first");
      return;
    }
    setBuying(true);
    const label = button.querySelector(".btn__label");
    const iconSlot = button.querySelector(".btn__icon");
    button.setAttribute("aria-busy", "true");
    iconSlot.innerHTML = icon("loader-circle", "btn__spinner");
    label.textContent = `Opening Stripe for $${pack.price}`;
    try {
      // real money: the server opens a Stripe Checkout session and the
      // round trip back credits the account after Stripe verifies it
      const res = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pack.id === "other" ? { amount: pack.price } : { pack: pack.id }) });
      const json = await res.json();
      if (!json.ok || !json.url) throw new Error(json.error || "checkout did not start");
      label.textContent = "Waiting on Stripe";
      window.location.assign(json.url);
    } catch (err) {
      pushNotification("system", `Checkout failed: ${String(err.message || err)}`);
      iconSlot.innerHTML = "";
      label.textContent = "Buy credits";
      setBuying(false);
    }
  });
  paint();
  subs.push(subscribe((topic, payload) => topic === "credits" && paint(payload)));
}

// ---------- account ----------

function accountMarkup() {
  const u = get().user;
  return `<div class="c-settings__section" data-settings-body="account">
  <h3 class="c-settings__h">Account</h3>
  <div class="app-account"><span class="app-account__pic"><span class="app-avatar app-avatar--big" data-avatar>${avatarInner(u)}</span><label class="btn btn--icon app-account__cam" aria-label="Change profile picture">${icon("camera")}<input type="file" accept="image/*" class="sr-only" data-avatar-file></label></span><span class="app-account__text"><span class="app-account__name" data-account-name>${escapeHtml(u.name)}</span><span class="app-account__email" data-account-email>${escapeHtml(u.email)}</span><button type="button" class="btn btn--quiet app-account__remove" data-avatar-remove${u.avatar ? "" : " hidden"}>Remove picture</button></span></div>
  <form class="app-form" data-account-form novalidate>
    <label class="c-card__field"><span class="c-card__label">Name</span><input class="c-card__input" name="name" value="${escapeHtml(u.name)}" autocomplete="name" required></label>
    <label class="c-card__field"><span class="c-card__label">Email</span><input class="c-card__input" name="email" type="email" value="${escapeHtml(u.email)}" autocomplete="email" required></label>
    <p class="c-card__error" data-card-error role="alert" hidden></p>
    <button type="submit" class="btn" data-account-save><span class="btn__icon"></span><span class="btn__label">Save changes</span></button>
  </form>
  <h4 class="c-settings__sub">Sessions</h4>
  <ul class="app-rows" data-sessions>${u.sessions.map((s) => `<li class="app-row" data-session="${s.id}">${icon(s.id === "mac" ? "monitor" : "sparkles")}<span class="app-row__text"><span class="app-row__title">${escapeHtml(s.device)}${s.id === "mac" ? ' <span class="app-pill">This device</span>' : ""}</span><span class="app-row__sub">${escapeHtml(s.where)}, ${escapeHtml(s.last)}</span></span><button type="button" class="btn btn--quiet" data-signout="${s.id}">${icon("log-out")}<span class="btn__label">Sign out</span></button></li>`).join("")}</ul>
  <div class="app-rows__empty" data-sessions-empty hidden><span>Signed out everywhere. Sign in again to keep going.</span><button type="button" class="btn" data-signin>Sign in on this Mac</button></div>
  <h4 class="c-settings__sub">Workspace</h4>
  <div class="app-row app-row--plain">${icon("rotate-ccw")}<span class="app-row__text"><span class="app-row__title">Reset demo data</span><span class="app-row__sub">Projects, credits, cards and notifications go back to how they started.</span></span><button type="button" class="btn btn--danger" data-reset>Reset</button></div>
  <h4 class="c-settings__sub">About</h4>
  <div class="app-row app-row--plain">${icon("command")}<span class="app-row__text"><span class="app-row__title">Version</span><span class="app-row__sub" data-version>Loading…</span></span></div>
</div>`;
}

// host: where the section lives. again() redraws it in place (the page
// re-routes, the modal repaints), leave(path) goes to a page (the modal
// closes first)
function wireAccount(stage, subs, host) {
  // the version the RUNNING deployment reports, not a build-time constant:
  // what this shows is what the server that answers is actually running
  fetch("/api/version").then((r) => r.json()).then((v) => {
    const el = stage.querySelector("[data-version]");
    if (el) el.textContent = `img v${v.version}`;
  }).catch((err) => console.error("version lookup failed:", err));
  const form = stage.querySelector("[data-account-form]");
  // the picture: chosen from a file, squared and kept; Remove goes back
  // to the initials
  const paintAvatar = () => {
    stage.querySelector("[data-avatar]").innerHTML = avatarInner(get().user);
    stage.querySelector("[data-avatar-remove]").hidden = !get().user.avatar;
  };
  stage.querySelector("[data-avatar-file]").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    try {
      const avatar = await squareImage(file, 128);
      setUser({ avatar });
      paintAvatar();
      announce("Profile picture updated");
    } catch (err) {
      console.error(err);
      announce("That image could not be read");
    }
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const error = form.querySelector("[data-card-error]");
    if (!name) return (error.hidden = false, (error.textContent = "Enter a name."), form.name.focus());
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return (error.hidden = false, (error.textContent = "Enter a working email address."), form.email.focus());
    error.hidden = true;
    const ran = await runButton(form.querySelector("[data-account-save]"), { busy: "Saving", done: "Saved", work: 800 });
    if (!ran) return;
    setUser({ name, email });
    paintAvatar();
    stage.querySelector("[data-account-name]").textContent = name;
    stage.querySelector("[data-account-email]").textContent = email;
    announce("Account saved");
  });
  stage.addEventListener("click", async (e) => {
    if (e.target.closest("[data-avatar-remove]")) {
      setUser({ avatar: null });
      paintAvatar();
      announce("Profile picture removed");
      return;
    }
    const out = e.target.closest("[data-signout]");
    if (out) {
      const row = out.closest("[data-session]");
      if (!reduceMotion()) await row.animate([{ opacity: 1, transform: "translateX(0)" }, { opacity: 0, transform: "translateX(12px)" }], { duration: 180, easing: EASE_STD }).finished;
      endSession(out.dataset.signout);
      row.remove();
      stage.querySelector("[data-sessions-empty]").hidden = get().user.sessions.length > 0;
      announce("Signed out");
      return;
    }
    if (e.target.closest("[data-signin]")) {
      setUser({ sessions: [{ id: "mac", device: "This Mac", where: "Ubud, Bali", last: "Now" }] });
      host.again();
      return;
    }
    if (e.target.closest("[data-reset]")) {
      if (!(await confirmDialog({ title: "Reset the demo data?", text: "Every project, message, card and notification goes back to the start.", action: "Reset everything", danger: true }))) return;
      await settle();
      resetAll();
      announce("Demo data reset");
      host.leave("/");
    }
  });
}

// ---------- billing ----------

function invoiceRow(i) {
  return `<tr><td>${shortDate(i.at)}</td><td class="app-table__id">${i.id}</td><td>${escapeHtml(i.desc)}</td><td class="app-table__num">$${i.amount}</td><td><span class="app-pill${i.status === "Refunded" ? " app-pill--muted" : ""}">${i.status}</span></td><td><button type="button" class="btn btn--icon btn--quiet" aria-label="Download ${i.id}" data-invoice="${i.id}">${icon("download")}</button></td></tr>`;
}

function billingMarkup() {
  const b = get().billing;
  const card = b.card
    ? `<div class="app-row app-row--plain" data-card-summary>${icon("credit-card")}<span class="app-row__text"><span class="app-row__title">${escapeHtml(b.card.brand)} ending ${escapeHtml(b.card.last4)}</span><span class="app-row__sub">${escapeHtml(b.card.holder)}${b.card.exp ? `, expires ${escapeHtml(b.card.exp)}` : ""}</span></span><button type="button" class="btn" data-card-replace>Replace card</button></div>`
    : `<p class="c-settings__line">No card yet. Add the one the packs bill to.</p>`;
  return `<div class="c-settings__section" data-settings-body="billing">
  <h3 class="c-settings__h">Billing</h3>
  <h4 class="c-settings__sub">Payment method</h4>
  ${card}
  <div data-card-slot${b.card ? " hidden" : ""}>${cardMarkup({ bare: true, id: "billing-card", action: b.card ? "Save new card" : "Save card" })}</div>
  <h4 class="c-settings__sub">Invoices</h4>
  <p class="c-settings__line">Receipts go to ${escapeHtml(get().user.email)} after each purchase.</p>
  <table class="app-table"><thead><tr><th>Date</th><th>Invoice</th><th>What</th><th class="app-table__num">Amount</th><th>Status</th><th><span class="sr-only">Download</span></th></tr></thead><tbody data-invoices>${b.invoices.map(invoiceRow).join("")}</tbody></table>
  <div class="app-rows__empty" data-invoices-empty${b.invoices.length ? " hidden" : ""}><span>No invoices yet. The first pack you buy lands here.</span><a class="btn" href="#/settings/credits">Buy credits</a></div>
</div>`;
}

function wireBilling(stage, subs, host) {
  const form = stage.querySelector("#billing-card");
  cardWire(form);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const card = await saveCard(form);
    if (!card) return;
    setCard(card);
    pushNotification("upload", `${card.brand} ending ${card.last4} saved`);
    await new Promise((r) => setTimeout(r, 900));
    host.again();
  });
  stage.addEventListener("click", (e) => {
    if (e.target.closest("[data-card-replace]")) {
      const slot = stage.querySelector("[data-card-slot]");
      slot.hidden = false;
      riseIn(slot, { y: 6 });
      slot.querySelector("[data-card-name]").focus();
      return;
    }
    const dl = e.target.closest("[data-invoice]");
    if (dl) {
      const i = get().billing.invoices.find((x) => x.id === dl.dataset.invoice);
      downloadText(`${i.id}.txt`, `Invoice ${i.id}\nDate: ${new Date(i.at).toDateString()}\nBilled to: ${get().user.name} <${get().user.email}>\n\n${i.desc}    $${i.amount}.00\nStatus: ${i.status}\n`);
      announce(`Downloaded ${i.id}`);
    }
  });
  subs.push(subscribe((topic) => {
    if (topic !== "billing") return;
    stage.querySelector("[data-invoices]").innerHTML = get().billing.invoices.map(invoiceRow).join("");
    stage.querySelector("[data-invoices-empty]").hidden = get().billing.invoices.length > 0;
  }));
}

const BODIES = { account: [accountMarkup, wireAccount], credits: [creditsMarkup, wireCredits], billing: [billingMarkup, wireBilling] };

export function render(root, { section }) {
  // an address with no section behind it (the old Notifications one included) opens Credits
  if (!BODIES[section]) {
    navigate("/settings/credits", { replace: true });
    return () => {};
  }
  document.title = `Settings: ${SECTIONS.find((s) => s.id === section).label}`;
  root.innerHTML = `<section class="app-settings"><div class="c-settings panel">
  <nav class="c-settings__nav" aria-label="Settings sections"><span class="c-settings__title">Settings</span>${SECTIONS.map((s) => `<a class="c-settings__item" href="#/settings/${s.id}" aria-current="${s.id === section ? "page" : "false"}">${icon(s.icon)}<span>${s.label}</span></a>`).join("")}</nav>
  <div class="c-settings__body" data-settings-stage>${BODIES[section][0]()}</div>
  <a class="btn btn--icon btn--quiet app-dialog__x app-settings__x" href="#/" aria-label="Close settings">${icon("x")}<span class="app-dialog__x-label">Close</span></a>
</div></section>`;
  const stage = root.querySelector("[data-settings-stage]");
  const subs = [];
  BODIES[section][1](stage, subs, { again: () => navigate(`/settings/${section}`, { replace: true }), leave: (path) => navigate(path) });
  riseIn(stage.firstElementChild, { y: 4 });
  return () => subs.forEach((off) => off());
}

// the same sections in a modal, opened from the rail's foot: the sections
// down the left as buttons, the open one at the right, and the page
// underneath untouched. Closing drops every store subscription the open
// section made
export function openSettingsDialog(section = "account") {
  const navMarkup = SECTIONS.map((s) => `<button type="button" class="c-settings__item" data-settings-go="${s.id}" aria-current="false">${icon(s.icon)}<span>${s.label}</span></button>`).join("");
  // on a phone the close button carries its word, so leaving is never a
  // hunt for a small cross
  return openDialog(
    `<div class="c-settings app-settings-modal">
  <nav class="c-settings__nav" aria-label="Settings sections"><span class="c-settings__title">Settings</span>${navMarkup}</nav>
  <div class="c-settings__body" data-settings-stage></div>
  <button type="button" class="btn btn--icon btn--quiet app-dialog__x" aria-label="Close" data-close>${icon("x")}<span class="app-dialog__x-label">Close</span></button>
</div>`,
    {
      label: "Settings",
      onOpen: (dialog, close) => {
        dialog.classList.add("app-dialog--settings");
        const stage = dialog.querySelector("[data-settings-stage]");
        let subs = [];
        let current = null;
        const show = (id, { animate = true } = {}) => {
          subs.forEach((off) => off());
          subs = [];
          current = id;
          for (const b of dialog.querySelectorAll("[data-settings-go]")) b.setAttribute("aria-current", b.dataset.settingsGo === id ? "true" : "false");
          stage.innerHTML = BODIES[id][0]();
          stage.scrollTop = 0;
          BODIES[id][1](stage, subs, {
            again: () => show(id, { animate: false }),
            leave: (path) => {
              close();
              navigate(path);
            },
          });
          if (animate) riseIn(stage.firstElementChild, { y: 4 });
        };
        dialog.addEventListener("click", (e) => {
          const go = e.target.closest("[data-settings-go]");
          if (go && go.dataset.settingsGo !== current) show(go.dataset.settingsGo);
        });
        dialog.addEventListener("close", () => subs.forEach((off) => off()));
        show(section, { animate: false });
      },
    },
  );
}
