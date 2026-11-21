// y = aˣ and y = log_a x (0 < a ≠ 1): inverse functions, graphs symmetric about y = x.

export const X_MIN = -3; // range of x₀, the abscissa of M on y = aˣ
export const X_MAX = 3;

export const initialState = () => ({
  a: 2, // base
  x: 1.5, // x₀: M(x₀; a^x₀) on y = aˣ, its mirror M'(a^x₀; x₀) on y = log_a x
  t: 4, // number whose logarithm is shown in the panel (may be ≤ 0 to show the domain)
});

/** A base is valid when 0 < a ≠ 1. */
export const validBase = a => Number.isFinite(a) && a > 0 && a !== 1;

/** aˣ, or null when the base is not valid. */
export const power = (a, x) => (validBase(a) && Number.isFinite(x) ? a ** x : null);

/** log_a t, or null when the base is not valid or t ≤ 0 (never NaN or ±∞). */
export const log = (a, t) => (validBase(a) && Number.isFinite(t) && t > 0 ? Math.log(t) / Math.log(a) + 0 : null); // + 0: no −0

/** true: đồng biến (a > 1), false: nghịch biến (0 < a < 1), null: not a valid base. */
export const increasing = a => (validBase(a) ? a > 1 : null);

export const clampX = x => Math.min(X_MAX, Math.max(X_MIN, x));

/**
 * x₀ for a pointer at (u, v) dragging M on y = aˣ: the curve point nearest to the pointer among
 * "same abscissa" (x₀ = u) and "same ordinate" (x₀ = log_a v), so the point follows the finger on
 * the flat and on the steep part of the curve. Dragging M' on y = log_a x is the same with u and v
 * swapped. Returns null when neither candidate exists.
 */
export function nearestX(a, u, v) {
  if (!validBase(a)) return null;
  let best = null;
  for (const x of [u, log(a, v)]) {
    if (x === null || !Number.isFinite(x)) continue;
    const c = clampX(x);
    const d = Math.hypot(c - u, power(a, c) - v);
    if (best === null || d < best.d) best = { x: c, d };
  }
  return best && best.x;
}
