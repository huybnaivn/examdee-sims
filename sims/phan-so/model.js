// Two fractions with non-negative integer numerators and positive integer denominators.

export const MAX = 12; // largest numerator and denominator offered

export const initialState = () => ({
  n1: 6, // numerator of A
  d1: 8, // denominator of A
  n2: 5, // numerator of B
  d2: 3, // denominator of B
  shape: "circle", // "circle" | "bar"
});

const int = (v, lo) => {
  const r = Math.round(Number(v));
  return Number.isFinite(r) ? Math.min(MAX, Math.max(lo, r)) : lo;
};

/** A safe fraction: integer numerator in [0, MAX], integer denominator in [1, MAX]. Never 0 below. */
export const fraction = (n, d) => ({ n: int(n, 0), d: int(d, 1) });

/** The two fractions of a state, sanitised. */
export const read = s => ({ a: fraction(s.n1, s.d1), b: fraction(s.n2, s.d2) });

export const gcd = (a, b) => {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
};

/** Cross-multiplication: -1 if p < q, 0 if equal, 1 if p > q. Denominators must be positive. */
export const compare = (p, q) => Math.sign(p.n * q.d - q.n * p.d);

/** Lowest terms: divide both by their gcd. 0/d becomes 0/1. */
export const simplify = ({ n, d }) => {
  const g = gcd(n, d) || 1;
  return { n: n / g, d: d / g };
};

/** Mixed number of the simplified fraction: whole + n/d with 0 <= n < d. */
export const toMixed = f => {
  const { n, d } = simplify(f);
  return { whole: Math.floor(n / d), n: n % d, d };
};

/** The first `count` fractions equal to f: the lowest terms times 1, 2, 3, ... */
export const equivalents = (f, count = 4) => {
  const s = simplify(f);
  return Array.from({ length: count }, (_, i) => ({ n: s.n * (i + 1), d: s.d * (i + 1) }));
};

/** True when the decimal expansion ends (lowest-terms denominator has only factors 2 and 5). */
export const terminates = f => {
  let { d } = simplify(f);
  for (const p of [2, 5]) while (d % p === 0) d /= p;
  return d === 1;
};
