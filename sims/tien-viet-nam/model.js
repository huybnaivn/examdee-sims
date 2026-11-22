// Vietnamese money for lớp 2–3: adding prices, paying with notes, working out the change,
// and making an amount with the fewest notes. All amounts are whole numbers of đồng, multiples of 1 000.

export const DENOMS = [1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000];
export const MAX_NOTES = 10; // notes that fit on one tray
export const MAX_TARGET = 500000;

export const ITEMS = [
  { name: "Bút chì", price: 3000, icon: "✏️" },
  { name: "Thước kẻ", price: 5000, icon: "📏" },
  { name: "Quyển vở", price: 7000, icon: "📓" },
  { name: "Hộp sữa", price: 8000, icon: "🥛" },
  { name: "Bánh mì", price: 15000, icon: "🍞" },
  { name: "Truyện tranh", price: 22000, icon: "📖" },
  { name: "Quả bóng", price: 45000, icon: "⚽" },
  { name: "Cặp sách", price: 120000, icon: "🎒" },
];
export const itemKey = i => `item${i}`;

export const initialState = () => ({
  mode: "shop", // "shop" | "fewest"
  ...Object.fromEntries(ITEMS.map((_, i) => [itemKey(i), i === 2 || i === 3])), // item0..item7: in the basket?
  phase: "pay", // shop: "pay" → "change" → "done"; fewest: "pay" → "done"
  paid: [20000], // notes handed over (shop) or laid out (fewest), in the order tapped
  back: [], // notes the learner gives as change
  target: 87000, // amount to make in "fewest" mode
  _note: "", // feedback line
  _good: false, // feedback is praise
});

/** 15000 → "15.000": dots between groups of three digits. */
export const dots = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
export const dong = n => `${dots(n)} đồng`;

export const sum = notes => notes.reduce((a, b) => a + b, 0);

/** Indexes of the items in the basket. */
export const basket = s => ITEMS.map((_, i) => i).filter(i => s[itemKey(i)] === true);

/** Total price of the basket. */
export const total = s => sum(basket(s).map(i => ITEMS[i].price));

/** Change = paid − total; null when the money is not enough. */
export const change = (paid, due) => (paid >= due ? paid - due : null);

/**
 * Try to pay. Refused when nothing was chosen ("empty") or the money is short ("short", with how much is missing).
 */
export function pay(due, paid) {
  if (due <= 0) return { ok: false, reason: "empty" };
  if (paid < due) return { ok: false, reason: "short", short: due - paid };
  return { ok: true, total: due, paid, change: paid - due };
}

/**
 * Fewest notes for an amount: always take the largest note that still fits (greedy).
 * For the Vietnamese values (1, 2, 5 × 1 000, 10 000, 100 000) greedy is the true minimum; the test checks it.
 * null when the amount cannot be made (negative or not a multiple of 1 000).
 */
export function fewest(amount) {
  if (!Number.isInteger(amount) || amount < 0 || amount % 1000) return null;
  const out = [];
  for (const d of [...DENOMS].reverse())
    while (amount >= d) {
      out.push(d);
      amount -= d;
    }
  return out;
}

/** The phase the state is really in (phase has no control, so it can be forged). */
export function phaseOf(s) {
  if (s.mode === "fewest") return s.phase === "done" && sum(s.paid) === s.target && s.paid.length === fewest(s.target)?.length ? "done" : "pay";
  const r = pay(total(s), sum(s.paid));
  if (!r.ok || !["change", "done"].includes(s.phase)) return "pay";
  return s.phase === "done" && sum(s.back) === r.change ? "done" : r.change === 0 ? "done" : "change";
}

const notes = v => (Array.isArray(v) ? v.filter(n => DENOMS.includes(n)).slice(0, MAX_NOTES) : null);

/** Untrusted state from the host: keep known keys of the right type, only real notes on the trays. */
export function sanitize(incoming, base) {
  const out = {};
  for (const key of Object.keys(base)) {
    if (key.startsWith("_")) continue;
    const v = incoming[key];
    if (Array.isArray(base[key])) out[key] = notes(v) ?? base[key];
    else if (typeof v === typeof base[key] && (typeof v !== "number" || Number.isFinite(v))) out[key] = v;
  }
  if (typeof out.target === "number") out.target = Math.min(MAX_TARGET, Math.max(1000, Math.round(out.target / 1000) * 1000));
  return out;
}

/** A new amount for "fewest" mode: 1 000 … 200 000, needing at least two notes. */
export function newTarget(rand, current) {
  for (;;) {
    const t = 1000 * (1 + Math.floor(rand() * 200));
    if (t !== current && fewest(t).length >= 2) return t;
  }
}
