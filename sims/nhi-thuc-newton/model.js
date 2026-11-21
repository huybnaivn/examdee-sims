// Newton's binomial (a + b)ⁿ = Σ Cₙᵏ aⁿ⁻ᵏ bᵏ and Pascal's triangle, n ≤ 12.

export const N_MAX = 12;

export const initialState = () => ({
  n: 3, // exponent
  target: 2, // the learner must find the coefficient of aⁿ⁻ᵗᵃʳᵍᵉᵗ·bᵗᵃʳᵍᵉᵗ
  pick: 0, // index k of the term the learner has chosen (term Tₖ₊₁)
  numeric: false, // plug numbers in for a and b
  a: 2,
  b: 1,
});

const int = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number.isFinite(Number(v)) ? Number(v) : 0)));

/** Cₙᵏ = n!/(k!(n − k)!), exact for the integers used here; 0 outside 0 ≤ k ≤ n. */
export function binom(n, k) {
  if (k < 0 || k > n) return 0;
  k = Math.min(k, n - k);
  let c = 1;
  for (let i = 1; i <= k; i++) c = (c * (n - k + i)) / i; // stays an integer at each step
  return c;
}

/** Row n of Pascal's triangle: Cₙ⁰ … Cₙⁿ. */
export const pascalRow = n => Array.from({ length: n + 1 }, (_, k) => binom(n, k));

/** Rows 0 … n built only by Pascal's rule Cₙᵏ = Cₙ₋₁ᵏ⁻¹ + Cₙ₋₁ᵏ. */
export function pascal(n) {
  const rows = [[1]];
  for (let r = 1; r <= n; r++) {
    const prev = rows[r - 1];
    rows.push(Array.from({ length: r + 1 }, (_, k) => (prev[k - 1] ?? 0) + (prev[k] ?? 0)));
  }
  return rows;
}

/** Terms Tₖ₊₁ = Cₙᵏ aⁿ⁻ᵏ bᵏ, k = 0 … n. */
export const terms = n => pascalRow(n).map((coef, k) => ({ k, coef, aPow: n - k, bPow: k }));

/** The term containing aᵖbᵠ (p + q = n), or null when there is none. */
export function termWith(n, p, q) {
  if (!Number.isInteger(p) || !Number.isInteger(q) || p < 0 || q < 0 || p + q !== n) return null;
  return { k: q, coef: binom(n, q), aPow: p, bPow: q };
}

/** Numerical values of the terms for given a, b, and their sum. */
export function numericTerms(n, a, b) {
  const values = terms(n).map(t => t.coef * a ** t.aPow * b ** t.bPow);
  return { values, sum: values.reduce((s, v) => s + v, 0) };
}

export const coefSum = n => pascalRow(n).reduce((s, c) => s + c, 0);
export const alternatingSum = n => pascalRow(n).reduce((s, c, k) => s + (k % 2 ? -c : c), 0);

/** Everything the screen shows; forged values are clamped. */
export function summary(s) {
  const n = int(s.n, 0, N_MAX);
  const target = int(s.target, 0, n);
  const pick = int(s.pick, 0, n);
  const a = Number.isFinite(Number(s.a)) ? Number(s.a) : 0;
  const b = Number.isFinite(Number(s.b)) ? Number(s.b) : 0;
  return {
    n,
    target,
    pick,
    a,
    b,
    terms: terms(n),
    rows: pascal(n),
    found: pick === target,
    answer: binom(n, target),
    numeric: numericTerms(n, a, b),
    power: (a + b) ** n,
  };
}
