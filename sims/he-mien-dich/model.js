// Immune response and herd immunity, two documented illustrative models.
//
// 1. Antibody level after an exposure to an antigen at day t₀ (relative units, U):
//    nothing during a lag L, then a smooth rise over R days to the peak P, then exponential decay
//    with time constant K:
//       τ = t − t₀ − L;  A = 0 (τ ≤ 0);  A = P·(1 − cos(πτ/R))/2 (0 < τ ≤ R);  A = P·e^−(τ−R)/K (τ > R)
//    Primary response (no memory cells yet):      L = 7, R = 7, P = 1,  K = 10  → peak 14 days after exposure
//    Secondary response (memory cells present):   L = 2, R = 3, P = 10, K = 30  → peak 5 days after exposure
//    Memory cells exist from MEMORY_AFTER days after any earlier exposure (pathogen or vaccine).
//    The total level is the sum of all responses.
//    Illness: a pathogen causes symptoms from INCUBATION days after exposure until the total antibody
//    level reaches PROTECT; if it gets there before then, there is no illness. A vaccine (killed or
//    weakened antigen) never causes the illness but does leave memory cells.
//
// 2. Herd immunity on a G×G grid of people, each in contact with its 8 neighbours. Infectious for
//    D days; each day an infectious person infects each susceptible neighbour with probability p.
//    A share `coverage` is vaccinated (assumed fully protected); INDEX_CASES people arrive infected.
//    All random numbers come from the seed and are drawn in a fixed order that does not depend on
//    the coverage (per person: vaccination draw; per contact: day of transmission), and vaccinated
//    sets grow with coverage, so for a fixed seed raising the coverage never adds infections.

export const DAYS = 100; // antibody graph length
export const PROTECT = 0.5; // protective antibody level, U
export const INCUBATION = 3; // days
export const MEMORY_AFTER = 7; // days
export const MAX_EXPOSURES = 4;
export const PRIMARY = { lag: 7, rise: 7, peak: 1, decay: 10 };
export const SECONDARY = { lag: 2, rise: 3, peak: 10, decay: 30 };

export const G = 40;
export const N = G * G;
export const INFECTIOUS_DAYS = 5;
export const P_DAY = 0.1;
export const INDEX_CASES = 4;
export const STOPPED_AT = 0.02; // outbreak counts as stopped when at most 2 % of people were ever infected
/** Chance that one infectious person infects one given neighbour, and the basic reproduction number. */
export const Q = 1 - (1 - P_DAY) ** INFECTIOUS_DAYS;
export const R0 = 8 * Q;

export const initialState = () => ({
  view: "antibody", // "antibody" | "herd"
  exposures: [{ t: 5, kind: "pathogen" }, { t: 45, kind: "pathogen" }],
  exposeDay: 20, // day for the next exposure
  exposeKind: "vaccine", // "vaccine" | "pathogen"
  time: DAYS, // cursor of the antibody graph, days
  coverage: 40, // % vaccinated
  seed: 2026,
  day: 1000, // day shown in the spread run (clamped to the end of the run)
});

const num = (v, lo, hi, d) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);

// ---------- 1. antibodies ----------

/** Exposures cleaned up: valid entries only, sorted by day, at most MAX_EXPOSURES. */
export function cleanExposures(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter(e => e && Number.isFinite(e.t) && (e.kind === "pathogen" || e.kind === "vaccine"))
    .map(e => ({ t: num(e.t, 0, DAYS, 0), kind: e.kind }))
    .sort((a, b) => a.t - b.t)
    .slice(0, MAX_EXPOSURES);
}

/** Antibody level of one response of type r, `tau` days after the exposure. */
export function response(r, tau) {
  const x = tau - r.lag;
  if (x <= 0) return 0;
  if (x <= r.rise) return (r.peak * (1 - Math.cos((Math.PI * x) / r.rise))) / 2;
  return r.peak * Math.exp(-(x - r.rise) / r.decay);
}

/** Response type of each exposure: secondary when memory cells from an earlier exposure exist. */
export function responses(list) {
  const ex = cleanExposures(list);
  return ex.map((e, i) => ({ ...e, type: ex.some((f, j) => j < i && e.t - f.t >= MEMORY_AFTER) ? SECONDARY : PRIMARY }));
}

export const antibody = (list, t) => responses(list).reduce((a, e) => a + response(e.type, t - e.t), 0);

/** Days of illness caused by exposure i (0 for a vaccine or when antibodies come in time). */
export function illness(list, i) {
  const rs = responses(list);
  const e = rs[i];
  if (!e || e.kind !== "pathogen") return { days: 0, start: 0, end: 0 };
  const start = e.t + INCUBATION;
  const dt = 0.01;
  let t = e.t;
  while (t < e.t + 60 && antibody(list, t) < PROTECT) t += dt;
  const days = Math.round(Math.max(0, t - start) * 10) / 10; // the search above is good to 0,01 day
  return { days, start, end: start + days };
}

/** What the learner sees for exposure i: when its response peaks and the (total) antibody level on that day. */
export function stats(list, i) {
  const e = responses(list)[i];
  const timeToPeak = e.type.lag + e.type.rise;
  return {
    day: e.t,
    vaccine: e.kind === "vaccine" ? 1 : 0,
    secondary: e.type === SECONDARY ? 1 : 0,
    peak: antibody(list, e.t + timeToPeak),
    timeToPeak,
    illnessDays: illness(list, i).days,
  };
}

// ---------- 2. herd immunity ----------

/** mulberry32 generator from a uint32 seed. */
export function generator(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = Math.imul(a ^ (a >>> 15), a | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export const nextSeed = seed => (Math.imul(seed >>> 0, 1664525) + 1013904223) >>> 0;

const NEIGHBOURS = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];

/**
 * Whole outbreak for a seed and coverage (%). Returns per person: vaccinated flag and the day of
 * infection (−1 never), plus totals. Deterministic.
 */
export function outbreak(seed, coverage) {
  const rand = generator(seed);
  const share = num(coverage, 0, 100, 0) / 100;
  const u = Float64Array.from({ length: N }, () => rand());
  const index = new Set();
  while (index.size < INDEX_CASES) index.add(Math.floor(rand() * N));
  // day (after the source got infected) on which each contact passes the infection on, 0 = never
  const delay = new Uint8Array(N * 8);
  const logq = Math.log(1 - P_DAY);
  for (let i = 0; i < N * 8; i++) {
    const k = 1 + Math.floor(Math.log(1 - rand()) / logq);
    delay[i] = k <= INFECTIOUS_DAYS ? k : 0;
  }
  const vaccinated = new Uint8Array(N);
  for (let i = 0; i < N; i++) vaccinated[i] = !index.has(i) && u[i] < share ? 1 : 0;
  const infDay = new Int32Array(N).fill(-1);
  const buckets = [[...index]];
  for (const i of index) infDay[i] = 0;
  // earliest infection day by increasing day (all delays ≥ 1, so a day's list is final when reached)
  for (let d = 0; d < buckets.length; d++) {
    for (const i of buckets[d] ?? []) {
      if (infDay[i] !== d) continue;
      const x = i % G;
      const y = (i - x) / G;
      NEIGHBOURS.forEach(([dx, dy], k) => {
        const nx = x + dx;
        const ny = y + dy;
        const w = delay[i * 8 + k];
        if (!w || nx < 0 || ny < 0 || nx >= G || ny >= G) return;
        const j = ny * G + nx;
        if (vaccinated[j] || (infDay[j] >= 0 && infDay[j] <= d + w)) return;
        infDay[j] = d + w;
        (buckets[d + w] ??= []).push(j);
      });
    }
  }
  let infected = 0;
  let last = 0;
  for (let i = 0; i < N; i++) {
    if (infDay[i] >= 0) {
      infected++;
      last = Math.max(last, infDay[i]);
    }
  }
  return { vaccinated, infDay, infected, fraction: infected / N, end: last + INFECTIOUS_DAYS, stopped: infected / N <= STOPPED_AT };
}

/** Counts on a given day of a run. */
export function census(run, day) {
  let vaccinated = 0, sick = 0, recovered = 0;
  for (let i = 0; i < N; i++) {
    if (run.vaccinated[i]) vaccinated++;
    const d = run.infDay[i];
    if (d >= 0 && d <= day) (day < d + INFECTIOUS_DAYS ? sick++ : recovered++);
  }
  return { vaccinated, sick, recovered, susceptible: N - vaccinated - sick - recovered };
}

/** Make a state from the host safe: known keys, right types, ranges. */
export function sanitize(incoming, base) {
  const out = {};
  for (const key of Object.keys(base)) {
    const v = incoming[key];
    if (key === "exposures") {
      if (Array.isArray(v)) out.exposures = cleanExposures(v);
    } else if (typeof v === typeof base[key] && (typeof v !== "number" || Number.isFinite(v))) {
      out[key] = v;
    }
  }
  if ("seed" in out) out.seed = out.seed >>> 0;
  if ("time" in out) out.time = num(out.time, 0, DAYS, DAYS);
  if ("day" in out) out.day = num(out.day, 0, 1e4, 0);
  return out;
}
