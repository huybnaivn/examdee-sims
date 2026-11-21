// Galton board: each ball meets `rows` pegs and goes right with probability p at each one.
// The bin it lands in is the number of times it went right, so it follows the binomial B(rows, p).

export const MAX_ROWS = 12;
export const MAX_PENDING = 1000;
export const RELEASE = 0.04; // s between two balls leaving the funnel
export const ROW_TIME = 0.12; // s a ball takes from one row of pegs to the next

const SEED = 2027;

const empty = rows => Array(rows + 1).fill(0);

export function initialState() {
  const s = {
    rows: 8,
    p: 0.5,
    seed: SEED, // state of the random generator: the same seed replays the same balls
    bins: empty(8), // bins[k] = balls that went right k times
    pending: 0, // balls still waiting to be released
    continuous: false,
    showTheory: true,
  };
  for (let i = 0; i < 100; i++) dropBall(s); // start with a sample on the board
  return s;
}

/** Seedable generator (mulberry32). Advances s.seed and returns a number in [0, 1). */
export function random(s) {
  s.seed = (s.seed + 0x6d2b79f5) >>> 0;
  let t = s.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Drop one ball: returns its path (1 = right, 0 = left at each row) and counts it in its bin. */
export function dropBall(s) {
  const path = [];
  let k = 0;
  for (let i = 0; i < s.rows; i++) {
    const right = random(s) < s.p ? 1 : 0;
    path.push(right);
    k += right;
  }
  s.bins[k]++;
  return path;
}

/** Empty the bins (after the number of rows or p changes, or on request). The seed keeps going. */
export function clear(s) {
  s.bins = empty(s.rows);
  s.pending = 0;
  s._balls = [];
}

export const busy = s => s.pending > 0 || s.continuous || (s._balls?.length ?? 0) > 0;

/** Release waiting balls at a steady rate and move the balls in flight (s._balls, display only). */
export function step(s, dt) {
  s._balls ??= [];
  s._wait = (s._wait ?? RELEASE) + dt;
  while (s._wait >= RELEASE && (s.pending > 0 || s.continuous)) {
    s._wait -= RELEASE;
    if (s.pending > 0) s.pending--;
    s._balls.push({ path: dropBall(s), t: 0 });
  }
  s._wait = Math.min(s._wait, RELEASE); // the next ball asked for leaves at once
  for (const b of s._balls) b.t += dt / ROW_TIME;
  s._balls = s._balls.filter(b => b.t < b.path.length + 1); // one more row to fall into the bin
}

export function choose(n, k) {
  let c = 1;
  for (let i = 1; i <= k; i++) c = (c * (n - k + i)) / i;
  return Math.round(c);
}

/** P(X = k) for X ~ B(n, p). */
export const binomial = (n, k, p) => choose(n, k) * p ** k * (1 - p) ** (n - k);

/** Mean np and standard deviation √(np(1 − p)) of B(n, p). */
export const theory = (n, p) => ({ mean: n * p, sd: Math.sqrt(n * p * (1 - p)) });

/** Number of balls, sample mean and standard deviation (dividing by N, as in the school formula). */
export function stats(bins) {
  const n = bins.reduce((a, b) => a + b, 0);
  if (!n) return { n: 0, mean: 0, sd: 0 };
  const mean = bins.reduce((a, c, k) => a + c * k, 0) / n;
  const variance = bins.reduce((a, c, k) => a + c * (k - mean) ** 2, 0) / n;
  return { n, mean, sd: Math.sqrt(variance) };
}

/** Keep only a well-formed saved state. */
export function sanitize(incoming, base) {
  const int = (v, lo, hi, d) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : d);
  const rows = int(incoming.rows, 1, MAX_ROWS, base.rows);
  const p = Number.isFinite(incoming.p) ? Math.min(1, Math.max(0, incoming.p)) : base.p;
  const ok = Array.isArray(incoming.bins) && incoming.bins.length === rows + 1 && incoming.bins.every(c => Number.isInteger(c) && c >= 0 && c <= 1e7);
  return {
    rows,
    p,
    seed: int(incoming.seed, 0, 0xffffffff, base.seed),
    bins: ok ? [...incoming.bins] : empty(rows),
    pending: int(incoming.pending, 0, MAX_PENDING, 0),
    continuous: incoming.continuous === true,
    showTheory: incoming.showTheory !== false,
  };
}
