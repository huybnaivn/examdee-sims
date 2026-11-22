// Springs loaded by hanging weights (static equilibrium, so elastic force = weight).
// Convention (KHTN 6): P = 10·m, i.e. g = 10 N/kg. SI units: N, m, N/m, kg.
//
// Documented model of the elastic limit:
// - every spring obeys F = k·Δl while its extension is at most X_LIMIT;
// - beyond that it yields: each extra newton stretches it 1/HARDEN times more than before;
// - when unloaded it comes back along a line of slope k, so it keeps a permanent set
//   (it no longer returns to its natural length).

export const G = 10; // N/kg
export const WEIGHT_MASS = 0.05; // kg, one slotted weight
export const MAX_COUNT = 10;
export const X_LIMIT = 0.16; // m, elastic limit of every spring
export const HARDEN = 0.5; // stiffness beyond the limit, as a fraction of k
export const NATURAL = 0.08; // m, natural length of every spring (drawing only)
export const K_MIN = 20;
export const K_MAX = 80;
export const TOLERANCE = 0.05; // relative error accepted for the unknown spring

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : lo));

export const initialState = () => ({
  setup: "single", // "single" | "series" | "parallel" | "unknown"
  k1: 25, // N/m
  k2: 50, // N/m
  count: 4, // weights on the hanger
  maxLoad: 2, // N, largest load these springs have carried (history for the permanent set)
  kx: 40, // N/m, stiffness of the unknown spring
  guess: 50, // N/m, the learner's answer
  verdict: 0, // 0 not checked, 1 right, -1 wrong
});

export const massOf = count => WEIGHT_MASS * count; // kg
export const weightOf = count => G * massOf(count); // N, P = 10·m

/**
 * One spring of stiffness k carrying force F, having carried at most Fmax before.
 * Returns { extension, permanent } in metres.
 */
export function spring(k, F, Fmax = 0) {
  const Fm = Math.max(F, Fmax, 0);
  const FL = k * X_LIMIT;
  const xm = Fm <= FL ? Fm / k : X_LIMIT + (Fm - FL) / (k * HARDEN);
  const permanent = xm - Fm / k; // 0 in the elastic range
  return { extension: permanent + Math.max(F, 0) / k, permanent };
}

/** Equivalent stiffness in the elastic range. */
export const seriesK = (k1, k2) => 1 / (1 / k1 + 1 / k2);
export const parallelK = (k1, k2) => k1 + k2;

export function stiffness(s) {
  if (s.setup === "unknown") return clamp(s.kx, K_MIN, K_MAX);
  if (s.setup === "series") return seriesK(s.k1, s.k2);
  if (s.setup === "parallel") return parallelK(s.k1, s.k2);
  return s.k1;
}

/**
 * The whole arrangement under `count` weights (default: what hangs now).
 * parts: each spring { k, force, extension, permanent }.
 * In parallel a rigid bar keeps both springs equally long; because every spring has the same
 * limit X_LIMIT, they share the load in proportion to k also beyond the limit.
 */
export function solve(s, count = s.count) {
  const load = weightOf(clamp(count, 0, MAX_COUNT));
  const top = weightOf(MAX_COUNT);
  const max = Math.max(load, clamp(s.maxLoad, 0, top));
  const k = stiffness(s);
  let parts;
  if (s.setup === "series") {
    parts = [s.k1, s.k2].map(ki => ({ k: ki, force: load, ...spring(ki, load, max) }));
  } else if (s.setup === "parallel") {
    parts = [s.k1, s.k2].map(ki => ({ k: ki, force: (load * ki) / k, ...spring(ki, (load * ki) / k, (max * ki) / k) }));
  } else {
    parts = [{ k, force: load, ...spring(k, load, max) }];
  }
  const sum = key => (s.setup === "series" ? parts[0][key] + parts[1][key] : parts[0][key]);
  const permanent = sum("permanent");
  return { load, mass: massOf(count), k, parts, extension: sum("extension"), permanent, elastic: permanent < 1e-12 };
}

/** Largest extension this arrangement can reach with all the weights (for the axes). */
export const maxExtension = s => solve({ ...s, maxLoad: 0 }, MAX_COUNT).extension;

/** Is the learner's value for the unknown spring close enough? */
export const guessIsRight = s => Math.abs(s.guess - stiffness({ ...s, setup: "unknown" })) <= TOLERANCE * stiffness({ ...s, setup: "unknown" });
