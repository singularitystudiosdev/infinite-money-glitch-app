// settings.js: the sections down the left, the open one at the right.
// Account, Credits (the frame) and Billing, every control wired to the store.
import { CREDITS_LOW, CREDIT_PACKS } from "../data.js";
import { icon } from "../icons.js";
import { navigate } from "../router.js";
import { CREDITS_PER_DOLLAR, addCredits, endSession, get, packById, projects, pushNotification, resetAll, setBillingRemote, setBuying, setCard, setInvoiceList, setNotify, setOther, setPack, setTopUp, setUser, subscribe } from "../store.js";
import { EASE_STD, announce, downloadText, escapeHtml, formatNum, odometerTo, reduceMotion, riseIn, runButton, shortDate } from "../util.js";
import { avatarInner, squareImage } from "./avatar.js";
import { cardMarkup, cardWire, saveCard } from "./card.js";
import { confirmDialog, openDialog, settle } from "./dialog.js";

export const SECTIONS = [
  { id: "account", label: "Account", icon: "user" },
  { id: "credits", label: "Credits", icon: "coins" },
  { id: "billing", label: "Billing", icon: "credit-card" },
  { id: "connections", label: "Connections", icon: "layout-grid" },
  { id: "notifications", label: "Notifications", icon: "bell" },
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
  stage.querySelector("[data-credits-topup]").addEventListener("change", async (e) => {
    const on = e.target.checked;
    setTopUp(on);
    announce(on ? "Top-up on" : "Top-up off");
    // the preference is the SERVER's (it is what charges the card off-session),
    // so the switch writes through. A page with no backend keeps the local
    // switch and says nothing: the sim must not depend on a server being there.
    try {
      const res = await fetch("/api/billing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "topup", topUp: on }) });
      if (!res.ok) throw new Error(`topup ${res.status}`);
      const json = await res.json();
      if (json.account?.billing) setBillingRemote(json.account.billing);
    } catch (err) {
      console.debug("top-up preference not saved to a backend:", err.message);
    }
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
  <div data-billing-live></div>
  <h4 class="c-settings__sub">Payment method</h4>
  ${card}
  <div data-card-slot${b.card ? " hidden" : ""}>${cardMarkup({ bare: true, id: "billing-card", action: b.card ? "Save new card" : "Save card" })}</div>
  <button type="button" class="btn" data-card-setup><span class="btn__icon"></span><span class="btn__label">Add a card</span></button>
  <h4 class="c-settings__sub">Invoices</h4>
  <p class="c-settings__line">Receipts go to ${escapeHtml(get().user.email)} after each purchase.</p>
  <table class="app-table"><thead><tr><th>Date</th><th>Invoice</th><th>What</th><th class="app-table__num">Amount</th><th>Status</th><th><span class="sr-only">Download</span></th></tr></thead><tbody data-invoices>${b.invoices.map(invoiceRow).join("")}</tbody></table>
  <div class="app-rows__empty" data-invoices-empty${b.invoices.length ? " hidden" : ""}><span>No invoices yet. The first pack you buy lands here.</span><a class="btn" href="#/settings/credits">Buy credits</a></div>
</div>`;
}

// the live block: plan, the caps in force, spend today and this week, the token
// split behind it and the per-project and per-connector breakdown. Everything
// here comes from one GET /api/billing; with no backend it stays empty and says
// so in one line rather than inventing a number.
const tokenLine = (t) => `${formatNum(t.input)} in, ${formatNum(t.cached)} cached, ${formatNum(t.output)} out`;

function billingLiveMarkup(v) {
  if (!v) return `<p class="c-settings__line" data-billing-note>No backend is answering, so these figures are not live.</p>`;
  const caps = v.caps || {};
  const row = (label, used, limit) => `<div class="app-row app-row--plain"><span class="app-row__text"><span class="app-row__title">${label}</span><span class="app-row__sub">${formatNum(used)} of ${limit ? formatNum(limit) : "no cap"} credits</span></span><span class="app-pill">${limit && used >= limit ? "Cap hit, held" : "Running"}</span></div>`;
  const projects = (v.usage?.byProject || []).slice(0, 5).map((p) => `<li class="app-row"><span class="app-row__text"><span class="app-row__title">${escapeHtml(p.projectId)}</span><span class="app-row__sub">${formatNum(p.credits)} credits over ${p.calls} call(s)</span></span></li>`).join("");
  const connectors = (v.usage?.byConnector || []).slice(0, 5).map((c) => `<li class="app-row"><span class="app-row__text"><span class="app-row__title">${escapeHtml(c.kind)}</span><span class="app-row__sub">${formatNum(c.credits)} credits over ${c.calls} call(s)</span></span></li>`).join("");
  return `<h4 class="c-settings__sub">Plan</h4>
  <div class="app-row app-row--plain">${icon("credit-card")}<span class="app-row__text"><span class="app-row__title">${escapeHtml(v.plan?.name || v.account?.billing?.planName || "Trial")}</span><span class="app-row__sub">${formatNum(v.plan?.includedCredits || 0)} credits included each month${v.plan?.overage ? ", overage from the meter" : ", no overage"}</span></span>${v.account?.billing?.status === "held" ? '<span class="app-pill">Held</span>' : ""}</div>
  <h4 class="c-settings__sub">Caps</h4>
  ${row("Today", v.usage?.today?.credits || 0, caps.tenant?.day?.limit)}
  ${row("This week", v.usage?.week?.credits || 0, null)}
  ${row("This month", caps.tenant?.month?.used || 0, caps.tenant?.month?.limit)}
  <h4 class="c-settings__sub">Where it went</h4>
  <p class="c-settings__line" data-token-split>Tokens: ${tokenLine(v.usage?.tokens || { input: 0, cached: 0, output: 0 })}</p>
  <ul class="app-rows" data-usage-projects>${projects || '<li class="app-row app-row--plain"><span class="app-row__text"><span class="app-row__sub">Nothing spent in the last 30 days.</span></span></li>'}</ul>
  <ul class="app-rows" data-usage-connectors>${connectors}</ul>`;
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

  // the live read: plan, caps, usage, invoices. It REPLACES the seeded sample
  // invoices the moment a server answers, so the page never shows a fabricated
  // receipt beside a real balance.
  const live = stage.querySelector("[data-billing-live]");
  const load = async () => {
    try {
      const res = await fetch("/api/billing");
      if (!res.ok) throw new Error(String(res.status));
      const v = await res.json();
      if (v.account?.billing) setBillingRemote(v.account.billing);
      if (Array.isArray(v.invoices)) {
        setInvoiceList(
          v.invoices.map((i) => ({ id: i.id, at: new Date(i.periodEnd || i.at).getTime(), amount: Number(i.amountUsd || 0).toFixed(2), desc: `Credits used ${new Date(i.periodStart).toISOString().slice(0, 10)} to ${new Date(i.periodEnd).toISOString().slice(0, 10)}`, status: i.status === "paid" ? "Paid" : "Open" })),
        );
      }
      if (live) live.innerHTML = billingLiveMarkup(v);
    } catch (err) {
      console.debug("billing read unavailable:", err.message);
      if (live) live.innerHTML = billingLiveMarkup(null);
    }
  };
  load();

  // the card step: the server mints a hosted setup page, the browser completes
  // it THERE, and the popup polls the verify leg until a payment method is
  // attached — the same shape every connector's connect ends with
  stage.querySelector("[data-card-setup]")?.addEventListener("click", async (e) => {
    const button = e.currentTarget;
    const label = button.querySelector(".btn__label");
    const slot = button.querySelector(".btn__icon");
    button.setAttribute("aria-busy", "true");
    if (slot) slot.innerHTML = icon("loader-circle", "btn__spinner");
    try {
      const made = await fetch("/api/card/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create" }) }).then((r) => r.json());
      if (!made.ok) throw new Error(made.error || "the card page did not open");
      if (made.url) window.open(made.url, "_blank", "noopener");
      if (label) label.textContent = "Waiting for the card";
      const intentId = made.setupIntentId;
      for (let i = 0; i < 60 && intentId; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const out = await fetch("/api/card/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "verify", setupIntentId: intentId }) }).then((r) => r.json());
        if (out.ok) {
          setCard({ brand: out.card.brand, last4: out.card.last4, exp: out.card.expMonth ? `${String(out.card.expMonth).padStart(2, "0")} / ${String(out.card.expYear).slice(-2)}` : "", holder: out.card.holder });
          pushNotification("upload", `${out.card.brand} ending ${out.card.last4} saved`);
          announce("Card saved");
          host.again();
          return;
        }
      }
      throw new Error("the card was not added");
    } catch (err) {
      pushNotification("system", `Card setup failed: ${String(err.message || err)}`);
      if (label) label.textContent = "Add a card";
    } finally {
      button.removeAttribute("aria-busy");
      if (slot) slot.innerHTML = "";
    }
  });

  stage.addEventListener("click", async (e) => {
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
      // the invoice the SERVER holds downloads from the server; a seeded sample
      // has no server behind it and falls back to the client's own text
      try {
        const res = await fetch(`/api/billing/invoice?id=${encodeURIComponent(i.id)}`);
        if (res.ok) {
          downloadText(`${i.id}.txt`, await res.text());
          announce(`Downloaded ${i.id}`);
          return;
        }
      } catch (err) {
        console.debug("invoice download fell back to the local copy:", err.message);
      }
      downloadText(`${i.id}.txt`, `Invoice ${i.id}\nDate: ${new Date(i.at).toDateString()}\nBilled to: ${get().user.name} <${get().user.email}>\n\n${i.desc}    $${i.amount}\nStatus: ${i.status}\n`);
      announce(`Downloaded ${i.id}`);
    }
  });
  subs.push(subscribe((topic) => {
    if (topic !== "billing") return;
    stage.querySelector("[data-invoices]").innerHTML = get().billing.invoices.map(invoiceRow).join("");
    stage.querySelector("[data-invoices-empty]").hidden = get().billing.invoices.length > 0;
  }));
}

const BODIES = { account: [accountMarkup, wireAccount], credits: [creditsMarkup, wireCredits], billing: [billingMarkup, wireBilling], connections: [connectionsMarkup, wireConnections], notifications: [notificationsMarkup, wireNotifications] };

// ---------- connections ----------
//
// What this account has connected, how each one is standing, and what the
// platform is building right now. The catalog read gives the stations; every
// connected row then reads its own health route, so a green "Connected" is a
// live probe rather than a stored claim, and a revoked grant shows as what it
// is with Reconnect one press away. Reconnecting is the SAME consent route the
// composer's popup uses, so re-consent and first-consent are one code path.
// When no backend answers (the static demo) the section says so in one line
// rather than failing open into an empty list.

const CAT_GROUPS = [
  { id: "connected", label: "Connected", empty: "Nothing is connected yet.", action: null },
  { id: "available", label: "Available", empty: "Every connector in the catalog is connected.", action: null },
  { id: "building", label: "Being built", empty: "Nothing is being built. A goal that needs a service the catalog lacks starts a build here.", action: null },
];

const tierLine = (c) =>
  c.tier === "browser"
    ? "browser-driven"
    : c.auth === "api_key"
      ? "one key"
      : c.auth === "session"
        ? "one-time sign-in"
        : c.auth === "none"
          ? "no sign-in needed"
          : "sign in once";

// one row: the provider mark, the name, what it does, and where it stands.
// Four slots of the five a row carries (mark, title, sub, status), so a row is
// never a bare name and a timestamp.
const catalogRow = (c) => {
  const status = c.status === "connected" ? "Connected" : c.status === "staged" ? "Built, waiting on uses" : c.status === "building" ? "Building" : "Ready to connect";
  const caps = (c.capabilities || []).slice(0, 3).map((x) => String(x).replace(/_/g, " ")).join(", ");
  const sub = [status, tierLine(c), caps].filter(Boolean).join(". ");
  // a connected row also carries its live probe line, under the static one
  const health = c.status === "connected" ? `<span class="app-row__sub" data-conn-health="${escapeHtml(c.id)}">Checking health…</span>` : "";
  const acts = c.status === "connected"
    ? `<button type="button" class="btn btn--quiet" data-reconnect="${escapeHtml(c.id)}"><span class="btn__label">Reconnect</span></button><button type="button" class="btn btn--quiet" data-disconnect="${escapeHtml(c.id)}"><span class="btn__label">Disconnect</span></button>`
    : `<button type="button" class="btn btn--quiet" data-connect="${escapeHtml(c.id)}"><span class="btn__label">Connect</span></button>`;
  return `<li class="app-row" data-connector="${escapeHtml(c.id)}">${icon(c.status === "connected" ? "check" : c.status === "building" ? "clock" : "compass")}<span class="app-row__text"><span class="app-row__title">${escapeHtml(c.name)}${c.provenance?.promotedAt ? ' <span class="app-pill">Shared</span>' : c.status === "staged" ? ' <span class="app-pill">Staged</span>' : ""}</span><span class="app-row__sub">${escapeHtml(sub)}</span>${health}</span><span class="app-conn__acts">${acts}</span></li>`;
};

// the health line for one connected row: what the platform's own probe last
// saw, never a claim the page makes up. A revoked grant reads as revoked.
const healthText = (h) => {
  if (!h) return "Health could not be read.";
  const status = h.health?.status || (h.connected ? "ok" : "unknown");
  const reason = h.health?.reason ? `, ${h.health.reason}` : "";
  const quota = h.quota ? `, ${formatNum(h.quota.used || 0)} of ${h.quota.limit ? formatNum(h.quota.limit) : "no"} calls today` : "";
  return `${h.connected ? "Connected" : "Not connected"}: ${status}${reason}${quota}`;
};

const buildingRow = (b) => `<li class="app-row" data-build="${escapeHtml(b.id)}">${icon("clock")}<span class="app-row__text"><span class="app-row__title">${escapeHtml(b.service || b.capability || "a connector")}</span><span class="app-row__sub">${escapeHtml([`Building (${b.phase})`, b.rung ? `reached ${b.rung}` : "", b.detail].filter(Boolean).join(". "))}</span></span></li>`;

const failedRow = (m) => `<li class="app-row" data-miss="${escapeHtml(m.id)}">${icon("circle-alert")}<span class="app-row__text"><span class="app-row__title">${escapeHtml(m.service || m.capability)}</span><span class="app-row__sub">${escapeHtml([`Could not be built (${m.evidence?.rung || "no surface"})`, m.evidence?.reason].filter(Boolean).join(". "))}</span></span><button type="button" class="btn btn--quiet" data-retry="${escapeHtml(m.id)}"><span class="btn__label">Try again</span></button></li>`;

const groupMarkup = (g) => `<section data-cat-group="${g.id}"><h4 class="c-settings__sub">${g.label} <span class="app-pill" data-cat-count="${g.id}">…</span></h4>
  <ul class="app-rows" data-cat-list="${g.id}">${[0, 1, 2].map(() => `<li class="app-row app-row--plain" data-skeleton aria-busy="true">${icon("loader-circle")}<span class="app-row__text"><span class="c-settings__skeleton" style="width: 9rem"></span><span class="c-settings__skeleton c-settings__skeleton--sub" style="width: 14rem"></span></span></li>`).join("")}</ul>
  <div class="app-rows__empty" data-cat-empty="${g.id}" hidden><span>${g.empty}</span></div></section>`;

function connectionsMarkup() {
  return `<div class="c-settings__section" data-settings-body="connections">
  <h3 class="c-settings__h">Connections</h3>
  <p class="c-settings__note" data-cat-summary aria-live="polite">Reading the catalog…</p>
  ${CAT_GROUPS.slice(0, 2).map(groupMarkup).join("")}
  <section data-cat-group="building"><h4 class="c-settings__sub">Being built <span class="app-pill" data-cat-count="building">…</span></h4>
    <ul class="app-rows" data-cat-list="building"></ul>
    <div class="app-rows__empty" data-cat-empty="building" hidden><span>Nothing is being built. A goal that needs a service the catalog lacks starts a build here.</span></div>
    <ul class="app-rows" data-cat-failed></ul>
  </section>
  <button type="button" class="btn btn--quiet" data-cat-refresh><span class="btn__icon">${icon("rotate-ccw")}</span><span class="btn__label">Refresh</span></button>
</div>`;
}

function wireConnections(stage, subs) {
  let alive = true;
  const paintGroup = (id, rows, emptyText) => {
    const list = stage.querySelector(`[data-cat-list="${id}"]`);
    const empty = stage.querySelector(`[data-cat-empty="${id}"]`);
    const count = stage.querySelector(`[data-cat-count="${id}"]`);
    if (!list) return;
    list.innerHTML = rows.join("");
    if (count) count.textContent = String(rows.length);
    if (empty) empty.hidden = rows.length > 0;
  };
  const load = async () => {
    const summary = stage.querySelector("[data-cat-summary]");
    if (summary) summary.textContent = "Reading the catalog…";
    let view = null;
    try {
      const res = await fetch("/api/catalog");
      if (res.ok) view = await res.json();
    } catch (err) {
      console.error("catalog read failed:", err);
    }
    if (!alive) return;
    if (!view) {
      for (const g of CAT_GROUPS) paintGroup(g.id, [], g.empty);
      paintGroup("building", [], CAT_GROUPS[2].empty);
      if (summary) summary.textContent = "No backend is answering here, so this page is reading a catalog with nothing live behind it.";
      return;
    }
    const customer = (view.connectors || []).filter((c) => !c.provenance?.promotedAt || true);
    const byStation = { connected: [], available: [], building: [] };
    for (const c of customer) (byStation[c.status] || byStation.available).push(catalogRow(c));
    paintGroup("connected", byStation.connected);
    paintGroup("available", byStation.available);
    paintGroup("building", (view.building || []).map(buildingRow));
    // each connected row reads its own probe: "connected" here means the
    // platform just checked, not that a grant was once stored
    for (const c of (view.connectors || []).filter((x) => x.status === "connected")) {
      fetch(`/api/connect/${encodeURIComponent(c.id)}/health`)
        .then((r) => (r.ok ? r.json() : null))
        .then((h) => {
          if (!alive) return;
          const slot = stage.querySelector(`[data-conn-health="${CSS.escape(c.id)}"]`);
          if (slot) slot.textContent = healthText(h);
        })
        .catch((err) => console.debug(`health for ${c.id}:`, err.message));
    }
    const failed = (view.misses || []).filter((m) => m.status === "failed" || m.status === "open");
    const failedList = stage.querySelector("[data-cat-failed]");
    if (failedList) failedList.innerHTML = failed.map(failedRow).join("");
    if (summary) {
      const n = view.counts || {};
      summary.textContent = `${n.connected || 0} connected, ${n.available || 0} available to connect, ${n.building || 0} being built${n.staged ? `, ${n.staged} staged for this account` : ""}.`;
    }
  };
  stage.querySelector("[data-cat-refresh]")?.addEventListener("click", () => load());
  stage.addEventListener("click", async (e) => {
    const retry = e.target.closest("[data-retry]");
    if (retry) {
      retry.setAttribute("aria-busy", "true");
      await fetch("/api/capabilities/build", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ missId: retry.dataset.retry }) }).catch((err) => console.error("build start failed:", err));
      announce("Building it now");
      load();
      return;
    }
    const connect = e.target.closest("[data-connect]");
    if (connect) {
      // the consent route the composer's popup uses, reached with no project:
      // a connector can be connected from here before any goal needed it
      const first = projects()[0];
      window.open(`/api/connect/${encodeURIComponent(connect.dataset.connect)}/start${first ? `?project=${encodeURIComponent(first.id)}` : ""}`, "_blank", "noopener");
      return;
    }
    // reconnect is the SAME route: consent is re-asked, so a revoked or stale
    // grant is repaired by the path that made it, never by a second flow
    const again = e.target.closest("[data-reconnect]");
    if (again) {
      const first = projects()[0];
      window.open(`/api/connect/${encodeURIComponent(again.dataset.reconnect)}/start${first ? `?project=${encodeURIComponent(first.id)}` : ""}`, "_blank", "noopener");
      announce(`Re-consent opened for ${again.dataset.reconnect}`);
      return;
    }
    const drop = e.target.closest("[data-disconnect]");
    if (drop) {
      drop.setAttribute("aria-busy", "true");
      try {
        const res = await fetch(`/api/connect/${encodeURIComponent(drop.dataset.disconnect)}/disconnect`, { method: "POST", headers: { "Content-Type": "application/json" } });
        if (!res.ok) throw new Error(String(res.status));
        announce(`${drop.dataset.disconnect} disconnected`);
      } catch (err) {
        console.error("disconnect failed:", err);
        announce("That connection could not be dropped");
      }
      drop.removeAttribute("aria-busy");
      load();
    }
  });
  load();
  const timer = setInterval(() => {
    if (!alive) return;
    const anyBuilding = stage.querySelector("[data-cat-list='building'] li[data-build]");
    if (anyBuilding) load();
  }, 5000);
  subs.push(() => {
    alive = false;
    clearInterval(timer);
  });
}

// ---------- notifications ----------
//
// Which of the agent's own events reach you, and where. Kept on the account
// (store setNotify) and read by pushNotification BEFORE a row is created, so a
// preference is enforced at the source rather than filtered at the bell.

const QUIET_LABEL = { off: "Off", "22-07": "22:00 to 07:00", all: "All the time" };
const NOTIFY_ROWS = [
  ["needs", "Asks", "A question only you can answer."],
  ["insight", "Insights", "Something it worked out worth reading."],
  ["sale", "Sales and money", "A sale, a payout, an invoice, a cap."],
  ["upload", "Uploads and artifacts", "Something published, generated or saved."],
  ["model", "Model notices", "A model call that failed or was held."],
  ["system", "System", "Platform notices, halts, security findings."],
  ["email", "Also email me", "A copy of every notification to the account's inbox."],
  ["bell", "In-app bell", "Show the badge and keep the log at all."],
];

function notificationsMarkup() {
  const n = get().notify;
  return `<div class="c-settings__section" data-settings-body="notifications">
  <h3 class="c-settings__h">Notifications</h3>
  <p class="c-settings__line">What reaches you, and where. Quiet hours hold the bell and the email together.</p>
  <ul class="app-rows" data-notify-list>${NOTIFY_ROWS.map(([id, label, hint]) => `<li class="app-row app-row--plain">${icon("bell")}<span class="app-row__text"><span class="app-row__title">${label}</span><span class="app-row__sub">${hint}</span></span><label class="c-settings__toggle c-settings__toggle--row"><input type="checkbox" class="c-settings__check" data-notify="${id}"${n[id] !== false ? " checked" : ""}><span class="sr-only">${label}</span></label></li>`).join("")}</ul>
  <h4 class="c-settings__sub">Quiet hours</h4>
  <div class="app-row app-row--plain">${icon("moon")}<span class="app-row__text"><span class="app-row__title">Hold the bell overnight</span><span class="app-row__sub">Asks still land; the rest waits until morning.</span></span><span class="c-dd"><button type="button" class="c-composer__chip pick-plain" aria-haspopup="menu" aria-expanded="false" data-quiet-chip><span data-quiet-label>${QUIET_LABEL[n.quiet] || "Off"}</span>${icon("chevron-down")}</button><div class="c-menu panel" role="menu" aria-label="Quiet hours" hidden>${["off", "22-07", "all"].map((q) => `<button type="button" class="c-menu__item" role="menuitemradio" aria-checked="${n.quiet === q}" data-quiet="${q}"><span class="c-menu__text">${QUIET_LABEL[q]}</span></button>`).join("")}</div></span></div>
</div>`;
}

function wireNotifications(stage) {
  stage.addEventListener("change", (e) => {
    const box = e.target.closest("[data-notify]");
    if (!box) return;
    setNotify(box.dataset.notify, box.checked);
    announce(`${box.dataset.notify} ${box.checked ? "on" : "off"}`);
  });
  const chip = stage.querySelector("[data-quiet-chip]");
  const menu = chip?.closest(".c-dd")?.querySelector(".c-menu");
  chip?.addEventListener("click", () => {
    const opening = menu.hidden;
    menu.hidden = !opening;
    chip.setAttribute("aria-expanded", String(opening));
  });
  menu?.addEventListener("click", (e) => {
    const pick = e.target.closest("[data-quiet]");
    if (!pick) return;
    setNotify("quiet", pick.dataset.quiet);
    for (const item of menu.querySelectorAll("[data-quiet]")) item.setAttribute("aria-checked", String(item === pick));
    stage.querySelector("[data-quiet-label]").textContent = QUIET_LABEL[pick.dataset.quiet];
    menu.hidden = true;
    chip.setAttribute("aria-expanded", "false");
    announce(`Quiet hours: ${QUIET_LABEL[pick.dataset.quiet].toLowerCase()}`);
  });
}

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
