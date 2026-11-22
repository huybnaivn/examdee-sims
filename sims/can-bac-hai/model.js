// Square roots: the side of a square of given area, squeezing √n between two-decimal numbers,
// √2 as the diagonal of a unit square, and √(a²b) = a√b.
// The squeeze works in whole hundredths (integers), so x² ≤ n is decided exactly.

export const N_MAX = 200; // largest area in "area" mode
export const M_MAX = 300; // largest number under the root in "simplify" mode

export const initialState = () => ({
  mode: "area", // "area" | "diagonal" | "simplify"
  n: 10, // area of the square
  lo: 3.1, // √n lies in [lo; hi), both multiples of 0,01
  hi: 3.2,
  trial: 3.2, // the side the learner tried last
  a: 1, // side of the square whose diagonal is drawn
  m: 72, // number under the root to simplify
});

/** Arithmetic square root, defined only for x ≥ 0 (null otherwise). */
export const sqrtReal = x => (Number.isFinite(x) && x >= 0 ? Math.sqrt(x) : null);

/** Largest whole a with a² ≤ n (exact for whole n). */
export function isqrt(n) {
  let a = Math.floor(Math.sqrt(n));
  while (a * a > n) a--;
  while ((a + 1) * (a + 1) <= n) a++;
  return a;
}

export const isPerfectSquare = n => Number.isInteger(n) && n >= 0 && isqrt(n) ** 2 === n;

/** Whole area 0..N_MAX from any (possibly forged) value. */
export const area = s => Math.min(N_MAX, Math.max(0, Math.round(Number.isFinite(s.n) ? s.n : 0)));

/** Consecutive whole numbers around √n: a ≤ √n < a + 1 (a = a for a perfect square). */
export function bracket(n) {
  const a = isqrt(n);
  return a * a === n ? [a, a] : [a, a + 1];
}

const H = x => Math.round(x * 100); // hundredths
const below = (X, n) => X * X <= n * 10000; // (X/100)² ≤ n, in integers

/** The current squeeze [lo; hi), checked: falls back to the whole-number bracket if the state is not valid. */
export function range(s) {
  const n = area(s);
  const [a, b] = bracket(n);
  if (a === b) return [a, b];
  const L = H(s.lo);
  const R = H(s.hi);
  const ok = Number.isFinite(s.lo) && Number.isFinite(s.hi) && L < R && L >= a * 100 && R <= b * 100 && below(L, n) && !below(R, n);
  return ok ? [L / 100, R / 100] : [a, b];
}

/** Start a new area: squeeze from the two whole numbers around √n. */
export function setArea(s) {
  s.n = area(s);
  [s.lo, s.hi] = bracket(s.n);
  s.trial = Math.round(((s.lo + s.hi) / 2) * 100) / 100;
}

/**
 * Try side x (rounded to 0,01): if x² ≤ n it becomes the lower bound, else the upper bound.
 * Returns false when x is outside the current squeeze (it tells nothing new).
 */
export function tryX(s, x) {
  const n = area(s);
  const [lo, hi] = range(s);
  const X = H(x);
  [s.lo, s.hi] = [lo, hi];
  if (!(X > H(lo) && X < H(hi))) return false;
  if (below(X, n)) s.lo = X / 100;
  else s.hi = X / 100;
  return true;
}

/** Midpoint of the squeeze, rounded down to 0,01: the next bisection trial. */
export const midpoint = s => {
  const [lo, hi] = range(s);
  return Math.floor((H(lo) + H(hi)) / 2) / 100;
};

/** √n is trapped to two decimals: lo ≤ √n < lo + 0,01. */
export function trapped(s) {
  const [lo, hi] = range(s);
  return lo !== hi && H(hi) - H(lo) === 1;
}

/** Plain bisection on [a; a + 1] for `steps` halvings (no rounding). */
export function bisect(n, steps) {
  let [lo, hi] = bracket(n);
  for (let i = 0; i < steps && lo !== hi; i++) {
    const mid = (lo + hi) / 2;
    if (mid * mid <= n) lo = mid;
    else hi = mid;
  }
  return [lo, hi];
}

/** True if no square greater than 1 divides b. */
export function squareFree(b) {
  for (let k = 2; k * k <= b; k++) if (b % (k * k) === 0) return false;
  return true;
}

/** m = a²·b with b square-free, so √m = a√b. */
export function simplify(m) {
  for (let a = isqrt(m); a >= 1; a--) if (m % (a * a) === 0) return { a, b: m / (a * a) };
  return { a: 1, b: m };
}

/** Whole number 1..M_MAX from any (possibly forged) value. */
export const radicand = s => Math.min(M_MAX, Math.max(1, Math.round(Number.isFinite(s.m) ? s.m : 1)));

/** Side of the square drawn in "diagonal" mode, 1..5. */
export const side = s => Math.min(5, Math.max(1, Math.round(Number.isFinite(s.a) ? s.a : 1)));
