// Derivative as the limit of secant slopes: f, f′, the tangent at M(x₀; f(x₀)) and the secant MN, N at x₀ + h.

export const X_MIN = -4;
export const X_MAX = 4;
export const STEP = 0.05; // slider step of x₀
export const TOL = 0.05; // |f′(x₀)| ≤ TOL counts as a stationary point

const always = () => true;

// `defined`: domain of f. `smooth`: where f′ exists (√x is defined at 0 but has no derivative there).
export const FUNCS = {
  sq: { name: "x²", dname: "2x", f: x => x * x, df: x => 2 * x, defined: always, smooth: always },
  cubic: { name: "x³ − 3x", dname: "3x² − 3", f: x => x ** 3 - 3 * x, df: x => 3 * x * x - 3, defined: always, smooth: always },
  sin: { name: "sin x", dname: "cos x", f: Math.sin, df: Math.cos, defined: always, smooth: always },
  exp: { name: "eˣ", dname: "eˣ", f: Math.exp, df: Math.exp, defined: always, smooth: always },
  inv: { name: "1/x", dname: "−1/x²", f: x => 1 / x, df: x => -1 / (x * x), defined: x => x !== 0, smooth: x => x !== 0 },
  sqrt: { name: "√x", dname: "1/(2√x)", f: Math.sqrt, df: x => 0.5 / Math.sqrt(x), defined: x => x >= 0, smooth: x => x > 0 },
};

export const initialState = () => ({
  fn: "sq", // key of FUNCS
  x0: 1, // abscissa of M
  h: 1, // gap to the second point N of the secant
  showDerivative: true, // draw the graph of f′ under the graph of f
});

const pick = fn => FUNCS[fn] ?? FUNCS.sq;
const z = v => v + 0; // -0 -> 0

/** f(x), or null outside the domain. */
export const value = (fn, x) => (Number.isFinite(x) && pick(fn).defined(x) ? z(pick(fn).f(x)) : null);

/** f′(x) from the analytic derivative, or null where it does not exist. */
export const derivative = (fn, x) => (Number.isFinite(x) && pick(fn).smooth(x) ? z(pick(fn).df(x)) : null);

/** Slope of the secant through (x; f(x)) and (x + h; f(x + h)); null if either point is missing. */
export function secantSlope(fn, x, h) {
  const y1 = value(fn, x);
  const y2 = value(fn, x + h);
  return h === 0 || y1 === null || y2 === null ? null : z((y2 - y1) / h);
}

/** Tangent at x₀ as y = slope·x + intercept, or null. */
export function tangent(fn, x0) {
  const slope = derivative(fn, x0);
  return slope === null ? null : { slope, intercept: z(value(fn, x0) - slope * x0) };
}

/** +1 where f is increasing at x, −1 where decreasing, 0 where f′ = 0, null where f′ does not exist. */
export function trend(fn, x) {
  const d = derivative(fn, x);
  return d === null ? null : Math.sign(d) + 0;
}

/**
 * Stationary point: |f′(x)| ≤ TOL and f′ really reaches 0 within one slider step
 * (so the flat tail of eˣ, where f′ is small but never 0, does not count).
 */
export const isStationary = (fn, x) => {
  const d = derivative(fn, x);
  const before = derivative(fn, x - STEP);
  const after = derivative(fn, x + STEP);
  return d !== null && before !== null && after !== null && Math.abs(d) <= TOL && before * after <= 0;
};

/** Everything the screen shows. Every number is finite or null, never NaN or ±∞. */
export function summary(s) {
  const x = Math.min(X_MAX, Math.max(X_MIN, s.x0));
  const h = Math.min(2, Math.max(0.01, s.h)); // forged h ≤ 0 would divide by zero
  const slope = derivative(s.fn, x);
  const secant = secantSlope(s.fn, x, h);
  return {
    x,
    h,
    y: value(s.fn, x),
    slope,
    x2: x + h,
    y2: value(s.fn, x + h),
    secant,
    gap: slope === null || secant === null ? null : Math.abs(secant - slope),
    tangent: tangent(s.fn, x),
    stationary: isStationary(s.fn, x),
  };
}
