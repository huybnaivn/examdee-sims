// Definite integral as signed area, and its approximation by Riemann sums and the trapezoidal rule.

export const X_MIN = -3;
export const X_MAX = 3;
export const N_MAX = 100;

// F is an antiderivative of f; `roots` are where f changes sign (used to split the area by sign).
export const FUNCS = {
  lin: { name: "x/2 + 1", Fname: "x²/4 + x", f: x => x / 2 + 1, F: x => (x * x) / 4 + x, roots: [-2] },
  sq: { name: "x²", Fname: "x³/3", f: x => x * x, F: x => x ** 3 / 3, roots: [] },
  cap: { name: "4 − x²", Fname: "4x − x³/3", f: x => 4 - x * x, F: x => 4 * x - x ** 3 / 3, roots: [-2, 2] },
  sin: { name: "sin x", Fname: "−cos x", f: Math.sin, F: x => -Math.cos(x), roots: [-Math.PI, 0, Math.PI] },
  exp: { name: "eˣ", Fname: "eˣ", f: Math.exp, F: Math.exp, roots: [] },
};

// Rule codes are also the `method` number sent in the result event.
export const RULES = {
  left: { code: 1, name: "Hình chữ nhật (đầu trái)" },
  right: { code: 2, name: "Hình chữ nhật (đầu phải)" },
  mid: { code: 3, name: "Hình chữ nhật (trung điểm)" },
  trap: { code: 4, name: "Hình thang" },
};

export const initialState = () => ({
  fn: "cap", // key of FUNCS
  a: -1, // lower limit
  b: 3, // upper limit (may be less than a)
  n: 8, // number of sub-intervals
  rule: "mid", // key of RULES
});

const pick = fn => FUNCS[fn] ?? FUNCS.cap;
const z = v => v + 0; // -0 -> 0

/** ∫ₐᵇ f(x) dx = F(b) − F(a). */
export const exact = (fn, a, b) => z(pick(fn).F(b) - pick(fn).F(a));

/** Pieces [x₀, x₁] (x₀ < x₁) of the segment between a and b, cut at the roots of f. */
export function pieces(fn, a, b) {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const cuts = [lo, ...pick(fn).roots.filter(r => r > lo && r < hi), hi];
  return cuts.slice(1).map((x1, i) => ({ x0: cuts[i], x1 }));
}

/** Geometric areas of the parts above (above) and below (below) the x axis between a and b, both ≥ 0. */
export function areas(fn, a, b) {
  let above = 0;
  let below = 0;
  for (const p of pieces(fn, a, b)) {
    const v = exact(fn, p.x0, p.x1);
    if (v >= 0) above += v;
    else below -= v;
  }
  return { above: z(above), below: z(below) };
}

/**
 * Approximation of ∫ₐᵇ f with n equal steps h = (b − a)/n (h < 0 when b < a, so the sign flips like the integral).
 * Returns the sum and the cells drawn on screen: x0, x1 (from a towards b) and the height used (two for a trapezoid).
 */
export function approximate(fn, a, b, n, rule) {
  const f = pick(fn).f;
  const k = Math.max(1, Math.min(N_MAX, Math.round(n) || 1));
  const h = (b - a) / k;
  const cells = [];
  let sum = 0;
  for (let i = 0; i < k; i++) {
    const x0 = a + i * h;
    const x1 = a + (i + 1) * h;
    let y0;
    let y1;
    if (rule === "trap") {
      y0 = f(x0);
      y1 = f(x1);
    } else {
      y0 = y1 = f(rule === "left" ? x0 : rule === "right" ? x1 : (x0 + x1) / 2);
    }
    sum += ((y0 + y1) / 2) * h;
    cells.push({ x0, x1, y0, y1 });
  }
  return { sum: z(sum), h, n: k, cells };
}

/** Everything the screen and the event show. Forged state is clamped here. */
export function summary(s) {
  const a = Math.min(X_MAX, Math.max(X_MIN, Number(s.a) || 0));
  const b = Math.min(X_MAX, Math.max(X_MIN, Number(s.b) || 0));
  const rule = RULES[s.rule] ? s.rule : "mid";
  const approx = approximate(s.fn, a, b, s.n, rule);
  const value = exact(s.fn, a, b);
  return { a, b, rule, ...approx, exact: value, error: Math.abs(approx.sum - value), ...areas(s.fn, a, b) };
}
