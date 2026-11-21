// Predator–prey model (Lotka–Volterra with logistic prey growth), time in years.
//   dR/dt = a·R·(1 − R/K) − b·R·F        R: rabbits (prey)
//   dF/dt = e·b·R·F − d·F                F: foxes (predators)
// a: prey birth rate (1/year), b: predation rate (fraction of the rabbits one fox catches per year),
// e: rabbits-to-foxes conversion (new foxes per rabbit eaten), d: fox death rate (1/year),
// K: carrying capacity of the habitat for rabbits. With `capacity` off, K = ∞ (the classic model).
// A population below EXTINCT animals is set to 0: the species has died out there.

export const E = 0.1; // conversion efficiency, fixed: 10 rabbits eaten feed one new fox
export const EXTINCT = 1; // animals
export const CAP = 1e6; // numbers are capped here so a runaway prey explosion stays finite

export const initialState = () => ({
  rabbits0: 400, // initial rabbits
  foxes0: 20, // initial foxes
  birth: 1, // a, 1/year
  predation: 0.02, // b, 1/(fox·year)
  death: 0.6, // d, 1/year
  capacity: true, // logistic limit on prey on/off
  K: 1000, // carrying capacity, rabbits
  rabbits: 400,
  foxes: 20,
  time: 0, // years
  peaks: 0, // fox peaks seen since the start
  rising: 1, // 1 while the fox number is going up, 0 while going down
  low: 20, // lowest fox number since the last peak (to ignore numerical ripples)
});

const num = (v, lo, hi, dflt) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt);

/** Parameters of state `s`, clamped to safe values. */
export const params = s => ({
  a: num(s.birth, 0, 5, 1),
  b: num(s.predation, 0, 1, 0.02),
  d: num(s.death, 0, 5, 0.6),
  K: s.capacity === false ? Infinity : num(s.K, 1, CAP, 1000),
});

export function rates(p, R, F) {
  const logistic = Number.isFinite(p.K) ? 1 - R / p.K : 1;
  return [p.a * R * logistic - p.b * R * F, E * p.b * R * F - p.d * F];
}

/** The coexistence equilibrium R* = d/(e·b), F* = (a/b)(1 − R* : K); null when foxes cannot persist. */
export function equilibrium(s) {
  const p = params(s);
  if (p.b <= 0) return null;
  const R = p.d / (E * p.b);
  const F = (p.a / p.b) * (Number.isFinite(p.K) ? 1 - R / p.K : 1);
  return F > 0 ? { rabbits: R, foxes: F } : null;
}

/** Quantity conserved by the classic model (no capacity): V = e·b·R − d·ln R + b·F − a·ln F. */
export function invariant(s) {
  const p = params(s);
  return E * p.b * s.rabbits - p.d * Math.log(s.rabbits) + p.b * s.foxes - p.a * Math.log(s.foxes);
}

const clean = v => (Number.isFinite(v) && v >= EXTINCT ? Math.min(v, CAP) : 0);

/**
 * Advance by dt years with RK4, splitting dt so each sub-step is small against the fastest rate.
 * Returns { peak: true } when the fox number has just passed a maximum, else {}.
 */
export function step(s, dt) {
  const p = params(s);
  let R = clean(s.rabbits);
  let F = clean(s.foxes);
  const fastest = p.a + p.b * F + E * p.b * R + p.d;
  const n = Math.min(10000, Math.max(1, Math.ceil((dt * fastest) / 0.05)));
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    const [k1r, k1f] = rates(p, R, F);
    const [k2r, k2f] = rates(p, R + (h / 2) * k1r, F + (h / 2) * k1f);
    const [k3r, k3f] = rates(p, R + (h / 2) * k2r, F + (h / 2) * k2f);
    const [k4r, k4f] = rates(p, R + h * k3r, F + h * k3f);
    R = Math.max(0, R + (h / 6) * (k1r + 2 * k2r + 2 * k3r + k4r));
    F = Math.max(0, F + (h / 6) * (k1f + 2 * k2f + 2 * k3f + k4f));
  }
  s.rabbits = clean(R);
  s.foxes = clean(F);
  s.time = (Number.isFinite(s.time) ? Math.max(0, s.time) : 0) + dt;
  return peakCheck(s, p);
}

// A peak is a turn from rising to falling, at least one fox above the lowest point since the last peak.
function peakCheck(s, p) {
  const growing = rates(p, s.rabbits, s.foxes)[1] > 0;
  let peak = false;
  if (s.rising && !growing && s.foxes > 0 && s.foxes - num(s.low, 0, CAP, 0) >= EXTINCT) {
    peak = true;
    s.peaks = Math.max(0, Math.round(s.peaks) || 0) + 1;
    s.low = s.foxes;
  }
  s.low = Math.min(num(s.low, 0, CAP, s.foxes), s.foxes);
  s.rising = growing ? 1 : 0;
  return peak ? { peak } : {};
}

/** Start again from the initial numbers. */
export function restart(s) {
  s.rabbits = clean(s.rabbits0);
  s.foxes = clean(s.foxes0);
  s.time = 0;
  s.peaks = 0;
  s.rising = 1;
  s.low = s.foxes;
  return s;
}

/** One-off events. Each returns the numbers before and after. */
export function hunt(s) {
  const before = s.foxes;
  s.foxes = clean(s.foxes / 2);
  s.low = Math.min(s.low, s.foxes);
  return { before, after: s.foxes };
}

export const WINTER_LOSS = 0.6; // a harsh winter kills 60 % of the rabbits
export function winter(s) {
  const before = s.rabbits;
  s.rabbits = clean(s.rabbits * (1 - WINTER_LOSS));
  return { before, after: s.rabbits };
}
