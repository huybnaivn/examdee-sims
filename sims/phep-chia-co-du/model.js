// Division with remainder on natural numbers: a = b × q + r with 0 ≤ r < b.
// Sharing picture: a counters are shared equally into b groups; each group gets q, r are left over.

export const MAX_A = 60; // counters on the table
export const MAX_B = 10; // groups
export const MAX_BIG = 9999; // long division
export const MAX_BIG_B = 99;

export const initialState = () => ({
  mode: "share", // "share" | "long" | "practice"
  a: 17,
  b: 5,
  bigA: 765,
  bigB: 4,
  step: 0, // how many long-division steps are shown
  qa: 23, // practice question: qa : qb
  qb: 4,
  ansQ: 0,
  ansR: 0,
  _solved: false,
  _tries: 0,
  _note: "", // feedback after "Kiểm tra"
});

/** Whole number in [lo, hi]; anything forged becomes lo. */
export const whole = (v, lo, hi) => {
  const r = Math.round(Number(v));
  return Number.isFinite(r) ? Math.min(hi, Math.max(lo, r)) : lo;
};

/** Quotient and remainder, or null when the division is not defined (b = 0, negatives, non-integers). */
export function divide(a, b) {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b <= 0) return null;
  const quotient = Math.floor(a / b);
  return { quotient, remainder: a - b * quotient };
}

/** a ⋮ b: the remainder is 0. False when the division is not defined. */
export const divisible = (a, b) => divide(a, b)?.remainder === 0;

/**
 * Long division (đặt tính) digit by digit. Each step: bring down a digit to get `partial`,
 * partial : b = q (one quotient digit), product = q × b, remainder = partial − product.
 * Leading steps whose quotient digit would be 0 are merged into the first step, as on paper
 * (765 : 9 starts with 76, not 7). `col` is the index of the last dividend digit used.
 */
export function longDivision(a, b) {
  if (!divide(a, b)) return null;
  let rem = 0;
  const all = String(a)
    .split("")
    .map((ch, col) => {
      const digit = Number(ch);
      const partial = rem * 10 + digit;
      const q = Math.floor(partial / b);
      rem = partial - q * b;
      return { col, digit, partial, q, product: q * b, remainder: rem };
    });
  let first = all.findIndex(s => s.q > 0);
  if (first < 0) first = all.length - 1; // a < b: one step, quotient 0
  const steps = all.slice(first);
  return { steps, quotient: Number(steps.map(s => s.q).join("")), remainder: rem };
}

/** The operands the view should use, clamped (state keys can be forged). */
export const shareOf = s => ({ a: whole(s.a, 0, MAX_A), b: whole(s.b, 0, MAX_B) });
export const longOf = s => ({ a: whole(s.bigA, 0, MAX_BIG), b: whole(s.bigB, 2, MAX_BIG_B) });
export const questionOf = s => ({ a: whole(s.qa, 0, 99), b: whole(s.qb, 2, 9) });

/** Judge a practice answer: "correct", "remainder-too-big" (a = b·q + r but r ≥ b) or "wrong". */
export function check(a, b, q, r) {
  const d = divide(a, b);
  if (!d) return "wrong";
  if (q === d.quotient && r === d.remainder) return "correct";
  if (Number.isInteger(q) && Number.isInteger(r) && q >= 0 && r >= b && b * q + r === a) return "remainder-too-big";
  return "wrong";
}

/** A new practice question: divisor 2..9, quotient 1..10, different from the current one. */
export function newQuestion(rand, current = {}) {
  for (;;) {
    const qb = 2 + Math.floor(rand() * 8);
    const qa = qb * (1 + Math.floor(rand() * 10)) + Math.floor(rand() * qb);
    if (qa !== current.qa || qb !== current.qb) return { qa, qb };
  }
}

/** A new long division: 3 or 4 digit dividend, divisor 2..9 (mostly) or two digits. */
export function newLong(rand) {
  const bigB = rand() < 0.7 ? 2 + Math.floor(rand() * 8) : 11 + Math.floor(rand() * 25);
  return { bigA: 100 + Math.floor(rand() * 9900), bigB };
}
