// Divisors, multiples, primes, ƯCLN and BCNN (grade 6).

export const LIMIT = 100; // the sieve grid 1..100
const int = (v, lo, hi, d) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : d);

export function isPrime(n) {
  if (!Number.isInteger(n) || n < 2) return false;
  for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
  return true;
}

/** "prime", "composite", or "neither" (0 and 1 are neither prime nor composite). */
export const classify = n => (n < 2 ? "neither" : isPrime(n) ? "prime" : "composite");

/** Prime factorisation as [[p, k], ...] with p ascending; 1 gives []. */
export function factorize(n) {
  const out = [];
  for (let p = 2; p * p <= n; p++) {
    let k = 0;
    while (n % p === 0) (n /= p), k++;
    if (k) out.push([p, k]);
  }
  if (n > 1) out.push([n, 1]);
  return out;
}

export const product = f => f.reduce((acc, [p, k]) => acc * p ** k, 1);

export function divisors(n) {
  const small = [];
  const big = [];
  for (let d = 1; d * d <= n; d++) {
    if (n % d) continue;
    small.push(d);
    if (d * d !== n) big.unshift(n / d);
  }
  return [...small, ...big];
}

export function gcd(a, b) {
  while (b) [a, b] = [b, a % b];
  return a;
}
export const lcm = (a, b) => (a && b ? (a / gcd(a, b)) * b : 0);

/** Euclid: rows [dividend, divisor, quotient, remainder] until the remainder is 0. */
export function euclidSteps(a, b) {
  const steps = [];
  if (a < b) [a, b] = [b, a];
  while (b) {
    steps.push([a, b, Math.floor(a / b), a % b]);
    [a, b] = [b, a % b];
  }
  return steps;
}

/** ƯCLN and BCNN from the factorisations: common primes with the least exponent, all primes with the greatest. */
export function viaFactors(a, b) {
  const fa = new Map(factorize(a));
  const fb = new Map(factorize(b));
  const primes = [...new Set([...fa.keys(), ...fb.keys()])].sort((x, y) => x - y);
  const g = primes.filter(p => fa.has(p) && fb.has(p)).map(p => [p, Math.min(fa.get(p), fb.get(p))]);
  const l = primes.map(p => [p, Math.max(fa.get(p) ?? 0, fb.get(p) ?? 0)]);
  return { gcd: g, lcm: l };
}

/** Factor tree: split n into the two factors closest to √n; a prime is a leaf. */
export function factorTree(n) {
  if (n < 4 || isPrime(n)) return { n };
  let a = Math.floor(Math.sqrt(n));
  while (n % a) a--;
  return { n, kids: [factorTree(a), factorTree(n / a)] };
}

/**
 * The Sieve of Eratosthenes as a list of operations:
 * cross out 1, then for each p with p² ≤ LIMIT still standing: circle p and cross its other
 * multiples not yet crossed; finally circle every number left.
 */
export const SIEVE = (() => {
  const ops = [{ type: "one", n: 1 }];
  const crossed = new Set([1]);
  for (let p = 2; p * p <= LIMIT; p++) {
    if (crossed.has(p)) continue;
    ops.push({ type: "prime", n: p });
    for (let m = 2 * p; m <= LIMIT; m += p) {
      if (crossed.has(m)) continue;
      crossed.add(m);
      ops.push({ type: "cross", n: m, by: p });
    }
  }
  ops.push({ type: "rest" });
  return ops;
})();

/** Grid after the first `index` operations: status[n] is 0 (open), 1 (crossed out) or 2 (prime). */
export function sieveAt(index) {
  index = int(index, 0, SIEVE.length, 0);
  const status = new Array(LIMIT + 1).fill(0);
  const by = new Array(LIMIT + 1).fill(0); // the prime that crossed each number out
  let current = 0; // prime whose multiples are being crossed
  for (const op of SIEVE.slice(0, index)) {
    if (op.type === "one" || op.type === "cross") (status[op.n] = 1), (by[op.n] = op.by ?? 0);
    if (op.type === "prime") (status[op.n] = 2), (current = op.n);
    if (op.type === "rest") {
      for (let n = 2; n <= LIMIT; n++) if (!status[n]) status[n] = 2;
      current = 0;
    }
  }
  const last = SIEVE[index - 1];
  return { status, by, current, last, done: index >= SIEVE.length, primes: status.filter(v => v === 2).length };
}

// Start with the multiples of 2 and 3 crossed out and 5 just circled: an informative first picture.
export const START = SIEVE.findIndex(op => op.type === "prime" && op.n === 5) + 1;

export const initialState = () => ({
  mode: "sieve",
  sieveIndex: START,
  speed: 8,
  n: 360,
  a: 84,
  b: 90,
  method: "factors",
  quizN: 91,
  quizScore: 0,
  quizTotal: 0,
  quizLast: "",
});

/** Clamp keys that have no control (they come back from the host and can be forged). */
export function tidy(s) {
  s.sieveIndex = int(s.sieveIndex, 0, SIEVE.length, START);
  s.quizN = int(s.quizN, 1, LIMIT, 91);
  s.quizTotal = int(s.quizTotal, 0, 1e6, 0);
  s.quizScore = int(s.quizScore, 0, s.quizTotal, 0);
  if (!["", "prime", "composite", "neither"].includes(s.quizLast)) s.quizLast = "";
  return s;
}

/** Advance the sieve animation; returns true on the step that finishes it. */
export function step(s, dt) {
  if (s.mode !== "sieve" || s.sieveIndex >= SIEVE.length) return false;
  s._acc = (s._acc ?? 0) + dt * s.speed;
  while (s._acc >= 1 && s.sieveIndex < SIEVE.length) {
    s._acc -= 1;
    s.sieveIndex++;
  }
  return s.sieveIndex >= SIEVE.length;
}

/** Check an answer in the quiz; returns whether it was right and updates the score. */
export function answer(s, kind) {
  const right = classify(s.quizN) === kind;
  s.quizTotal++;
  if (right) s.quizScore++;
  s.quizLast = kind;
  return right;
}
