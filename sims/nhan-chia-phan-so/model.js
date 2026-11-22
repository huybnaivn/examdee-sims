// Multiplying and dividing fractions.
//   a/b × c/d = (a × c)/(b × d)           area model: a rectangle a/b wide and c/d high
//   a/b : c/d = a/b × d/c = (a × d)/(b × c)   "how many times does c/d fit into a/b"; c ≠ 0

export const MAX_N = 10; // numerators 0..10
export const MAX_D = 10; // denominators 1..10

export const initialState = () => ({
  mode: "explore", // "explore" | "practice"
  op: "mul", // "mul" | "div"
  n1: 3,
  d1: 4,
  n2: 2,
  d2: 3,
  mixed: true, // also write a result greater than 1 as a mixed number
  _tried: [], // wrong choices already pressed, as "n/d"
  _solved: false,
});

/** Whole number in [lo, hi]; anything forged becomes lo. */
export const whole = (v, lo, hi) => {
  const r = Math.round(Number(v));
  return Number.isFinite(r) ? Math.min(hi, Math.max(lo, r)) : lo;
};

/** The two fractions of a state, clamped. */
export const operands = s => ({ n1: whole(s.n1, 0, MAX_N), d1: whole(s.d1, 1, MAX_D), n2: whole(s.n2, 0, MAX_N), d2: whole(s.d2, 1, MAX_D) });

export const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));

/** Lowest terms; 0 is 0/1. */
export const simplify = (n, d) => {
  const g = gcd(n, d) || 1;
  return { n: n / g, d: d / g };
};

/** Product before simplifying: numerator × numerator over denominator × denominator. */
export const multiply = (n1, d1, n2, d2) => ({ n: n1 * n2, d: d1 * d2 });

/** The inverted fraction (phân số đảo ngược), or null for 0. */
export const reciprocal = (n, d) => (n === 0 ? null : { n: d, d: n });

/** Quotient before simplifying = multiply by the reciprocal; null when dividing by 0. */
export const divide = (n1, d1, n2, d2) => {
  const r = reciprocal(n2, d2);
  return r && multiply(n1, d1, r.n, r.d);
};

/** Result of the state's calculation: raw (as first written) and in lowest terms; null when not defined. */
export function calculate(s) {
  const { n1, d1, n2, d2 } = operands(s);
  const raw = s.op === "div" ? divide(n1, d1, n2, d2) : multiply(n1, d1, n2, d2);
  return raw && { raw, ...simplify(raw.n, raw.d) };
}

/** Mixed number: whole part and a proper fraction (n < d). */
export const toMixed = (n, d) => ({ whole: Math.floor(n / d), n: n % d, d });

/**
 * Area model. Every unit square is cut into d1 columns and d2 rows, so one cell is 1/(d1 × d2).
 * The product is the rectangle n1 cells wide and n2 cells high: n1 × n2 cells.
 * When a fraction is greater than 1 the rectangle runs over more than one unit square.
 */
export function area(n1, d1, n2, d2) {
  return { cols: d1, rows: d2, unitsX: Math.max(1, Math.ceil(n1 / d1)), unitsY: Math.max(1, Math.ceil(n2 / d2)), cellsPerUnit: d1 * d2, overlap: n1 * n2 };
}

/** What cell (column i, row j) shows: "both" (the product), "a" (first fraction's strip), "b" (second's strip) or "none". */
export const cellKind = (i, j, n1, d1, n2, d2) => (i < n1 && j < n2 ? "both" : i < n1 && j < d2 ? "a" : j < n2 && i < d1 ? "b" : "none");

/**
 * Division as measuring: cut both into parts of 1/(d1 × d2). The dividend is `partsA` parts,
 * one copy of the divisor is `partsB` parts; it fits `whole` times and `rest` parts are left,
 * that is rest/partsB of one more copy. null when dividing by 0.
 */
export function fitting(n1, d1, n2, d2) {
  if (n2 === 0) return null;
  const partsA = n1 * d2;
  const partsB = n2 * d1;
  return { unit: d1 * d2, partsA, partsB, whole: Math.floor(partsA / partsB), rest: partsA % partsB };
}

export const same = (p, q) => p.n * q.d === q.n * p.d;

/**
 * Six different answers for practice, smallest first: the right one in lowest terms and the usual mistakes
 * (not inverting, inverting the wrong fraction, adding tops and bottoms, cross-multiplying when multiplying).
 */
export function choices(s) {
  const { n1, d1, n2, d2 } = operands(s);
  const right = calculate(s);
  if (!right) return [];
  const out = [{ n: right.n, d: right.d }];
  const add = (n, d) => {
    if (!(n > 0 && d > 0) || out.length >= 6) return;
    const f = simplify(n, d);
    if (!out.some(o => same(o, f))) out.push(f);
  };
  add(n1 * n2, d1 * d2);
  add(n1 * d2, d1 * n2);
  add(d1 * n2, n1 * d2);
  add(n1 + n2, d1 + d2);
  add(d1 * d2, n1 * n2);
  add(n1 + n2, d1 * d2);
  for (let k = 1; out.length < 6; k++) {
    add(right.n + k, right.d);
    add(right.n, right.d + k);
  }
  return out.sort((p, q) => p.n * q.d - q.n * p.d);
}

/** A practice question with small proper fractions, never a zero divisor, different from the current one. */
export function newQuestion(rand, current = {}) {
  const pick = () => {
    const d = 2 + Math.floor(rand() * 5); // 2..6
    return [1 + Math.floor(rand() * (d - 1)), d];
  };
  for (;;) {
    const [n1, d1] = pick();
    const [n2, d2] = pick();
    if (n1 !== current.n1 || d1 !== current.d1 || n2 !== current.n2 || d2 !== current.d2) return { n1, d1, n2, d2 };
  }
}
