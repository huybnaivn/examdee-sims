// Rational numbers on the number line: p/q is reached by cutting every unit segment into q equal
// parts and counting p parts from 0. All comparisons are done in whole numbers, never in floats.

export const P_MAX = 12; // |numerator| limit of the sliders
export const Q_MAX = 12;

const int = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(Number.isFinite(v) ? v : 0)));

export const gcd = (a, b) => {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
};
export const lcm = (a, b) => (a / gcd(a, b)) * b;

/** Lowest terms with a positive denominator. */
export function reduce(p, q) {
  if (q < 0) [p, q] = [-p, -q];
  const g = gcd(p, q) || 1;
  return [p / g || 0, q / g]; // never −0
}

/** −1, 0 or 1 as a/b is less than, equal to or greater than c/d (b, d > 0). */
export const compare = (a, b, c, d) => Math.sign(a * d - c * b);

/** p/q = unit + part/q with 0 ≤ part < q: which unit segment the point is in, and how many parts into it. */
export function locate(p, q) {
  const unit = Math.floor(p / q);
  return { unit, part: p - unit * q };
}

/** Numerator of the mark k/q nearest to x. */
export const snap = (x, q) => int(x * q, -P_MAX, P_MAX);

export function primeFactors(n) {
  const out = [];
  for (let f = 2; n > 1; f++) for (; n % f === 0; n /= f) out.push(f);
  return out;
}

/** A fraction is a finite decimal exactly when its reduced denominator has no prime factor but 2 and 5. */
export const isFiniteDecimal = (p, q) => primeFactors(reduce(p, q)[1]).every(f => f === 2 || f === 5);

/** Long division. `pre` are the digits before the repeating block `rep` ("" when the decimal is finite). */
export function decimal(p, q) {
  [p, q] = reduce(p, q);
  const n = Math.abs(p);
  let r = n % q;
  const seen = new Map();
  let digits = "";
  while (r && !seen.has(r)) {
    seen.set(r, digits.length);
    r *= 10;
    digits += Math.floor(r / q);
    r %= q;
  }
  const start = r ? seen.get(r) : digits.length;
  return { negative: p < 0, whole: Math.floor(n / q), pre: digits.slice(0, start), rep: digits.slice(start) };
}

/** Textbook notation: decimal comma, repeating block in brackets, e.g. −0,41(6). */
export function decimalText(p, q) {
  const d = decimal(p, q);
  return `${d.negative ? "−" : ""}${d.whole}${d.pre || d.rep ? "," : ""}${d.pre}${d.rep ? `(${d.rep})` : ""}`;
}

export const periodLength = (p, q) => decimal(p, q).rep.length;

/**
 * Back from a decimal to a fraction (not reduced), the way it is done by hand:
 * finite: digits / 10^k;  repeating: (all digits − digits before the block) / (10^m · (10^r − 1)).
 * `minus` is the number subtracted in the numerator (0 when finite).
 */
export function fromDecimal({ negative, whole, pre, rep }) {
  const head = Number(`${whole}${pre}`);
  const all = Number(`${whole}${pre}${rep}`);
  const sign = negative ? -1 : 1;
  return { all, minus: rep ? head : 0, num: sign * (rep ? all - head : head), den: 10 ** pre.length * (rep ? 10 ** rep.length - 1 : 1) };
}

export const opposite = (p, q) => [-p || 0, q];
/** |p/q| is the distance from the point to 0. */
export const absolute = (p, q) => [Math.abs(p), Math.abs(q)];
export const distance = (p, q) => Math.abs(p / q);

/** The line runs from −M to M so every listed value has room on both sides. */
export const lineRange = values => Math.max(2, ...values.map(v => Math.floor(Math.abs(v)) + 1));

// ---------- ordering ----------
// Each card is [p, q, form]: "f" is shown as a fraction, "d" as a decimal.
export const SETS = [
  [[1, 2, "f"], [-3, 4, "d"], [2, 3, "f"], [3, 5, "d"]],
  [[-1, 3, "f"], [-3, 10, "d"], [1, 4, "f"], [1, 5, "d"]],
  [[5, 4, "f"], [6, 5, "d"], [-3, 2, "f"], [-8, 5, "d"]],
  [[1, 3, "d"], [3, 10, "d"], [2, 5, "f"], [7, 20, "d"]],
  [[-5, 6, "f"], [-4, 5, "d"], [-7, 8, "f"], [-8, 9, "d"]],
  [[3, 5, "f"], [2, 3, "d"], [5, 8, "f"], [13, 20, "d"]],
];

export const setAt = index => SETS[((int(index, -1e6, 1e6) % SETS.length) + SETS.length) % SETS.length];

/** A saved order is a string like "2031". Anything that is not a permutation falls back to "0123". */
export function parseOrder(order, n = 4) {
  const ids = [...String(order)].map(Number);
  const ok = ids.length === n && [...ids].sort().every((v, i) => v === i);
  return ok ? ids : Array.from({ length: n }, (_, i) => i);
}

export function swap(order, i, j) {
  const ids = parseOrder(order);
  if (ids[i] == null || ids[j] == null) return ids.join("");
  [ids[i], ids[j]] = [ids[j], ids[i]];
  return ids.join("");
}

/** The correct order (smallest first) as a string of card indexes. */
export const sortedOrder = set =>
  set
    .map((_, i) => i)
    .sort((i, j) => compare(set[i][0], set[i][1], set[j][0], set[j][1]))
    .join("");

export function isOrdered(set, order) {
  const ids = parseOrder(order, set.length);
  return ids.every((id, k) => k === 0 || compare(set[ids[k - 1]][0], set[ids[k - 1]][1], set[id][0], set[id][1]) < 0);
}

export const initialState = () => ({
  mode: "explore", // "explore" | "compare" | "order"
  num: 3,
  den: 4,
  num2: 2,
  den2: 3,
  showOpposite: true,
  setIndex: 0,
  order: "0123", // card indexes of the current set, left to right
  pick: 1, // selected card, 1-based
  status: "", // "" | "right" | "wrong"
  solved: 0,
});

/** The two numbers on screen, clamped (state can be forged). */
export function numbers(s) {
  return {
    a: [int(s.num, -P_MAX, P_MAX), int(s.den, 1, Q_MAX)],
    b: [int(s.num2, -P_MAX, P_MAX), int(s.den2, 1, Q_MAX)],
  };
}

export function nextSet(s) {
  s.setIndex = (int(s.setIndex, 0, 1e6) + 1) % SETS.length;
  s.order = "0123";
  s.pick = 1;
  s.status = "";
  return s;
}
