// Arithmetic (cấp số cộng) and geometric (cấp số nhân) sequences: terms, nth term, partial and infinite sums.

export const N_MAX = 20;
export const U_LIM = 10; // |u₁| ≤ 10
export const D_LIM = 5; // |d| ≤ 5
export const Q_LIM = 3; // |q| ≤ 3

export const initialState = () => ({
  kind: "geo", // "arith" | "geo"
  u1: 1, // first term u₁
  d: 2, // common difference d of the arithmetic sequence
  q: 1.5, // common ratio q of the geometric sequence
  n: 10, // number of terms
  overlay: true, // also draw the other kind with the same u₁
});

const z = v => v + 0; // -0 -> 0
const lim = (v, m) => Math.min(m, Math.max(-m, Number(v) || 0));

/** uₙ = u₁ + (n − 1)d */
export const arithTerm = (u1, d, n) => z(u1 + (n - 1) * d);
/** Sₙ = n(u₁ + uₙ)/2 */
export const arithSum = (u1, d, n) => z((n * (u1 + arithTerm(u1, d, n))) / 2);
/** uₙ = u₁·qⁿ⁻¹ */
export const geoTerm = (u1, q, n) => z(u1 * q ** (n - 1));
/** Sₙ = u₁(1 − qⁿ)/(1 − q) for q ≠ 1, n·u₁ for q = 1 */
export const geoSum = (u1, q, n) => z(q === 1 ? n * u1 : (u1 * (1 - q ** n)) / (1 - q));
/** S = u₁/(1 − q) when |q| < 1; null otherwise (the sum of infinitely many terms has no finite limit unless u₁ = 0). */
export const geoInfinite = (u1, q) => (Math.abs(q) < 1 ? z(u1 / (1 - q)) : null);

/** u₁ … uₙ */
export const terms = (kind, u1, c, n) =>
  Array.from({ length: n }, (_, i) => (kind === "arith" ? arithTerm(u1, c, i + 1) : geoTerm(u1, c, i + 1)));

/**
 * Middle-term property at index k (1 < k < n):
 * arithmetic uₖ = (uₖ₋₁ + uₖ₊₁)/2, geometric uₖ² = uₖ₋₁·uₖ₊₁. Returns both sides, or null when n < 3.
 */
export function middle(kind, u1, c, n) {
  if (n < 3) return null;
  const k = Math.ceil(n / 2);
  const t = j => (kind === "arith" ? arithTerm(u1, c, j) : geoTerm(u1, c, j));
  return kind === "arith"
    ? { k, left: t(k), right: z((t(k - 1) + t(k + 1)) / 2) }
    : { k, left: z(t(k) ** 2), right: z(t(k - 1) * t(k + 1)) };
}

/** Everything the screen shows, with forged state clamped. */
export function summary(s) {
  const kind = s.kind === "arith" ? "arith" : "geo";
  const u1 = lim(s.u1, U_LIM);
  const d = lim(s.d, D_LIM);
  const q = lim(s.q, Q_LIM);
  const n = Math.max(1, Math.min(N_MAX, Math.round(Number(s.n)) || 1));
  const c = kind === "arith" ? d : q;
  return {
    kind,
    u1,
    d,
    q,
    n,
    c,
    terms: terms(kind, u1, c, n),
    un: kind === "arith" ? arithTerm(u1, d, n) : geoTerm(u1, q, n),
    sum: kind === "arith" ? arithSum(u1, d, n) : geoSum(u1, q, n),
    infinite: kind === "geo" ? geoInfinite(u1, q) : null,
    middle: middle(kind, u1, c, n),
    other: terms(kind === "arith" ? "geo" : "arith", u1, kind === "arith" ? q : d, n),
  };
}
