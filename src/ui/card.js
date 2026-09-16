// card.js: the credit card form, shared by the setup step and Billing. The
// fields format themselves as you type, the number names its brand, and
// Save runs the loading-to-done shape.
import { icon } from "../icons.js";
import { runButton } from "../util.js";

// bare: no panel and no head, for when the form sits inside a step that
// already names it
// the form never charges anything, so the browser must not offer a real
// saved card on it (or, over plain http, warn that it will not). Chrome
// ignores autocomplete="off" on payment fields and overrides an unknown
// value with its own card classification from the labels
// (chromium components/autofill/core/browser/autofill_field.cc,
// ShouldSuppressSuggestionsAndFillingByDefault); a recognised token it
// holds no data for is what actually switches its payment autofill off
const NO_AUTOFILL = 'autocomplete="transaction-amount"';

export function cardMarkup({ bare = false, id = "card", action = "Save card" } = {}) {
  return `<form class="c-card${bare ? " c-card--bare" : " panel"}" id="${id}" novalidate autocomplete="off" aria-label="Credit card">
  ${bare ? "" : `<span class="c-card__head">${icon("credit-card")}<span class="c-card__title">Credit card</span></span>`}
  <label class="c-card__field">
    <span class="c-card__label">Name on card</span>
    <input class="c-card__input" name="holder" ${NO_AUTOFILL} placeholder="Name as printed" data-card-name>
  </label>
  <label class="c-card__field">
    <span class="c-card__label"><span>Card number</span><span class="c-card__brand" data-card-brand hidden></span></span>
    <input class="c-card__input" name="digits" inputmode="numeric" ${NO_AUTOFILL} placeholder="1234 5678 9012 3456" maxlength="19" data-card-number>
  </label>
  <span class="c-card__row">
    <label class="c-card__field">
      <span class="c-card__label">Expiry</span>
      <input class="c-card__input" name="valid-until" inputmode="numeric" ${NO_AUTOFILL} placeholder="MM / YY" maxlength="7" data-card-exp>
    </label>
    <label class="c-card__field">
      <span class="c-card__label">CVC</span>
      <input class="c-card__input" name="code" inputmode="numeric" ${NO_AUTOFILL} placeholder="123" maxlength="4" data-card-cvc>
    </label>
  </span>
  <p class="c-card__error" data-card-error role="alert" hidden></p>
  <button type="submit" class="btn c-card__save" data-card-save><span class="btn__icon"></span><span class="btn__label">${action}</span></button>
</form>`;
}

// brand from the leading digits (the issuer identification number), which
// also decides the length, the grouping and the size of the security code
const CARD_BRANDS = [
  { name: "Visa", test: /^4/, length: 16, groups: [4, 4, 4, 4], cvc: 3 },
  { name: "Mastercard", test: /^(5[1-5]|2(2[2-9]|[3-6]|7[01]|720))/, length: 16, groups: [4, 4, 4, 4], cvc: 3 },
  { name: "Amex", test: /^3[47]/, length: 15, groups: [4, 6, 5], cvc: 4 },
  { name: "Discover", test: /^6(011|5)/, length: 16, groups: [4, 4, 4, 4], cvc: 3 },
];
const CARD_DEFAULT = { name: "", length: 16, groups: [4, 4, 4, 4], cvc: 3 };

const cardBrand = (digits) => CARD_BRANDS.find((b) => b.test.test(digits)) || CARD_DEFAULT;
const cardDigits = (value) => value.replace(/\D/g, "");

function formatCardNumber(digits, brand) {
  const out = [];
  let i = 0;
  for (const size of brand.groups) {
    if (i >= digits.length) break;
    out.push(digits.slice(i, i + size));
    i += size;
  }
  return out.join(" ");
}

export function formSetError(form, message, field) {
  const error = form.querySelector("[data-card-error]");
  for (const input of form.querySelectorAll(".c-card__input")) input.removeAttribute("aria-invalid");
  if (!message) {
    error.hidden = true;
    error.textContent = "";
    return;
  }
  error.textContent = message;
  error.hidden = false;
  if (field) {
    field.setAttribute("aria-invalid", "true");
    field.focus();
  }
}

// the number takes its spaces and names its brand, the expiry takes its
// slash, and a finished field hands focus to the next one; deleting never
// re-inserts a separator
export function cardWire(form) {
  const number = form.querySelector("[data-card-number]");
  const brandEl = form.querySelector("[data-card-brand]");
  const exp = form.querySelector("[data-card-exp]");
  const cvc = form.querySelector("[data-card-cvc]");
  number.addEventListener("input", () => {
    const digits = cardDigits(number.value);
    const brand = cardBrand(digits);
    const kept = digits.slice(0, brand.length);
    number.value = formatCardNumber(kept, brand);
    number.maxLength = brand.length + brand.groups.length - 1;
    brandEl.textContent = brand.name;
    brandEl.hidden = !brand.name;
    cvc.maxLength = brand.cvc;
    cvc.placeholder = brand.cvc === 4 ? "1234" : "123";
    formSetError(form, "");
    if (kept.length === brand.length) exp.focus();
  });
  exp.addEventListener("input", (e) => {
    const digits = cardDigits(exp.value).slice(0, 4);
    const deleting = e.inputType === "deleteContentBackward";
    if (digits.length >= 3) exp.value = `${digits.slice(0, 2)} / ${digits.slice(2)}`;
    else if (digits.length === 2 && !deleting) exp.value = `${digits} / `;
    else exp.value = digits;
    formSetError(form, "");
    if (digits.length === 4) cvc.focus();
  });
  cvc.addEventListener("input", () => {
    cvc.value = cardDigits(cvc.value).slice(0, cvc.maxLength);
    formSetError(form, "");
  });
  form.querySelector("[data-card-name]").addEventListener("input", () => formSetError(form, ""));
}

// nothing is charged and nothing is checked: whatever is typed is the card.
// The result always carries a brand, the last four and a holder so the
// step's summary reads whole even when a field was left empty
export function cardValidate(form) {
  const name = form.querySelector("[data-card-name]");
  const number = form.querySelector("[data-card-number]");
  const exp = form.querySelector("[data-card-exp]");
  const digits = cardDigits(number.value);
  const brand = cardBrand(digits);
  return { brand: brand.name || "Card", last4: digits.slice(-4).padStart(4, "0"), exp: exp.value, holder: name.value.trim() || "Cardholder" };
}

// Save card: take the card, spin, lock the fields, hold as Saved; resolves
// with the card, or null when the form is already saved or mid-save
export async function saveCard(form, { busy = "Saving", done = "Saved" } = {}) {
  const button = form.querySelector("[data-card-save]");
  if (form.classList.contains("is-saved") || button.dataset.busy) return null;
  const result = cardValidate(form);
  formSetError(form, "");
  form.classList.add("is-saving");
  await runButton(button, { busy, done, keep: true });
  form.classList.remove("is-saving");
  form.classList.add("is-saved");
  for (const input of form.querySelectorAll(".c-card__input")) input.readOnly = true;
  return result;
}
