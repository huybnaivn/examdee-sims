// Limits of sequences: terms uₙ, the limit, and the index N from which every term lies in (L − ε; L + ε).

export const N_SCAN = 100000; // N is searched among u₁ … u_N_SCAN
export const GUESS_TOL = 0.005; // a guess within half a slider step of the limit counts as correct
export const SEQS = ["inv", "alt", "ratio", "geo", "e", "poly"];

export const initialState = () => ({
  seq: "alt", // one of SEQS
  q: 0.8, // ratio of qⁿ
  p2: 2, // numerator p2·n² + p1·n + p0
  p1: 0,
  p0: 1,
  r2: 1, // denominator r2·n² + r1·n + r0
  r1: 0,
  r0: 3,
  guess: 0, // the limit L the learner picks
  eps: 0.1, // ε
  nShow: 30, // number of terms plotted
  showLimit: false, // reveal the true limit
});

const z = v => v + 0;
const fin = v => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Integer polynomial coefficients from the state, clamped to [−5; 5]. */
const ints = (s, keys) => keys.map(k => Math.max(-5, Math.min(5, Math.round(fin(s[k])))));
export const numer = s => ints(s, ["p2", "p1", "p0"]);
export const denom = s => ints(s, ["r2", "r1", "r0"]);
const poly = ([c2, c1, c0], n) => (c2 * n + c1) * n + c0;

/** Leading coefficient and degree of [c2, c1, c0]; degree −1 for the zero polynomial. */
export function lead(cs) {
  const i = cs.findIndex(c => c !== 0);
  return i < 0 ? { deg: -1, c: 0 } : { deg: 2 - i, c: cs[i] };
}

/** The n-th term (n ≥ 1), or null where it is undefined (denominator 0). */
export function term(s, n) {
  switch (s.seq) {
    case "inv":
      return 1 / n;
    case "alt":
      return (n % 2 ? -1 : 1) / n;
    case "ratio":
      return (n + 1) / n;
    case "geo":
      return z(fin(s.q) ** n);
    case "e":
      return (1 + 1 / n) ** n;
    case "poly": {
      const d = poly(denom(s), n);
      return d === 0 ? null : z(poly(numer(s), n) / d);
    }
  }
  return null;
}

/**
 * The limit: { value } with a finite value, { value: ±Infinity } for a sequence tending to ±∞,
 * or { value: null } when there is no limit (oscillating, or undefined from some index on).
 */
export function limit(s) {
  switch (s.seq) {
    case "inv":
    case "alt":
      return { value: 0 };
    case "ratio":
      return { value: 1 };
    case "e":
      return { value: Math.E };
    case "geo": {
      const q = fin(s.q);
      if (Math.abs(q) < 1) return { value: 0 };
      if (q === 1) return { value: 1 };
      return { value: q > 1 ? Infinity : null }; // q ≤ −1 oscillates
    }
    case "poly": {
      const P = lead(numer(s));
      const Q = lead(denom(s));
      if (Q.deg < 0) return { value: null }; // denominator ≡ 0
      if (P.deg < 0) return { value: 0 };
      if (P.deg < Q.deg) return { value: 0 };
      if (P.deg === Q.deg) return { value: z(P.c / Q.c) };
      return { value: Math.sign(P.c * Q.c) * Infinity };
    }
  }
  return { value: null };
}

/**
 * Smallest N with |uₙ − L| < ε for every n ≥ N, or null when there is none.
 * ponytail: decided from u₁ … u_N_SCAN; a term outside the band in the second half of the scan means "no N".
 * Right for these sequences (each is eventually monotone or alternates with shrinking amplitude);
 * an N beyond N_SCAN/2 would be reported as "none".
 */
export function findN(s, L, eps) {
  let lastOut = 0;
  for (let n = 1; n <= N_SCAN; n++) {
    const u = term(s, n);
    if (u === null || !(Math.abs(u - L) < eps)) lastOut = n;
  }
  return lastOut > N_SCAN / 2 ? null : lastOut + 1;
}

export const isCorrectGuess = (lim, guess) => lim.value !== null && Number.isFinite(lim.value) && Math.abs(guess - lim.value) <= GUESS_TOL + 1e-9;

let memo = { key: "", value: null };

/** Everything the screen shows (memoised: the N search scans 10⁵ terms). */
export function summary(s) {
  const key = JSON.stringify(s, (k, v) => (k.startsWith("_") ? undefined : v));
  if (key !== memo.key) memo = { key, value: compute(s) };
  return memo.value;
}

function compute(s) {
  const eps = Math.max(0.01, Math.min(1, fin(s.eps)));
  const guess = fin(s.guess);
  const nShow = Math.max(5, Math.min(200, Math.round(fin(s.nShow))));
  const lim = limit(s);
  const terms = [];
  for (let n = 1; n <= nShow; n++) terms.push(term(s, n));
  return { eps, guess, nShow, lim, terms, N: findN(s, guess, eps), correct: isCorrectGuess(lim, guess) };
}
