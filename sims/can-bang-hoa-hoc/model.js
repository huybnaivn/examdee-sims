// Reversible gas reactions in a closed vessel at a fixed temperature.
//
// Kinetic model (deliberately simple, documented here and on screen):
//   net rate of reaction  v = k_t·Π[reactant]^a − k_n·Π[product]^b      mol/(L·s)
// i.e. mass-action forward and reverse rates with the stoichiometric coefficients as orders, and
//   k_t = k·√K_C,  k_n = k/√K_C,  so k_t / k_n = K_C and the system always settles where Q = K_C.
// ponytail: k is one illustrative constant per reaction (the `kf` field), chosen so that equilibrium
// is reached in a few seconds at every temperature. Real mechanisms, orders and time scales differ;
// only the equilibrium position (K_C) and the direction of a shift are meant to be read quantitatively.
//
// K_C(T) follows the van 't Hoff equation with a constant enthalpy of reaction:
//   K(T) = K_ref · exp( −ΔH/R · (1/T − 1/T_ref) )
// (applied to K_C directly, which ignores the small RT·Δn difference between K_C and K_p).

export const R = 8.314; // J/(mol·K)
export const VOLUME = [0.5, 2]; // L
export const DT_RANGE = 50; // K either side of the reaction's middle temperature
export const AMOUNT_STEP = 0.5; // mol added or removed per press
export const MAX_ADD = 6; // mol: nothing more can be added above this
export const EQ_TOL = 1e-3; // "at equilibrium" when forward and reverse rates agree this closely
const LIMIT = 20; // mol, bound for amounts arriving in a forged state
const SHIFT_EPS = 1e-3; // mol of extent below which a shift counts as "none"
export const KEYS = ["n1", "n2", "n3"];
export const INIT_KEYS = ["init1", "init2", "init3"];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// nu: stoichiometric numbers (negative = reactant). dH in kJ per mole of reaction as written.
// kRef is K_C at tRef (K); tMid is the middle of the temperature slider.
export const REACTIONS = {
  nh3: {
    equation: "N₂(g) + 3H₂(g) ⇌ 2NH₃(g)",
    species: ["N₂", "H₂", "NH₃"],
    atoms: [{ N: 2 }, { H: 2 }, { N: 1, H: 3 }],
    nu: [-1, -3, 2],
    dH: -92,
    kRef: 0.06,
    tRef: 773,
    tMid: 773,
    kf: 0.06,
    init: [1, 3, 0],
  },
  n2o4: {
    equation: "N₂O₄(g) ⇌ 2NO₂(g)",
    species: ["N₂O₄", "NO₂"],
    atoms: [{ N: 2, O: 4 }, { N: 1, O: 2 }],
    nu: [-1, 2],
    dH: 58,
    kRef: 4.6e-3,
    tRef: 298,
    tMid: 348,
    kf: 0.3,
    init: [1, 0],
  },
  hi: {
    equation: "H₂(g) + I₂(g) ⇌ 2HI(g)",
    species: ["H₂", "I₂", "HI"],
    atoms: [{ H: 2 }, { I: 2 }, { H: 1, I: 1 }],
    nu: [-1, -1, 2],
    dH: -9.4,
    kRef: 54.3,
    tRef: 703,
    tMid: 703,
    kf: 0.3,
    init: [1, 1, 0],
  },
};

export const reactionOf = s => REACTIONS[s.reaction] ?? REACTIONS.nh3;
export const temperature = s => reactionOf(s).tMid + clamp(s.dT, -DT_RANGE, DT_RANGE); // K
export const equilibriumConstant = (rx, T) => rx.kRef * Math.exp(((-rx.dH * 1000) / R) * (1 / T - 1 / rx.tRef));
export const kC = s => equilibriumConstant(reactionOf(s), temperature(s));
export const volume = s => clamp(s.volume, VOLUME[0], VOLUME[1]);
/** Amounts (mol) of the species of the current reaction. */
export const amounts = s => reactionOf(s).nu.map((_, i) => clamp(s[KEYS[i]], 0, LIMIT));
export const concentrations = s => amounts(s).map(n => n / volume(s)); // mol/L
/** Change in the number of gas moles per mole of reaction (products − reactants). */
export const deltaGasMoles = rx => rx.nu.reduce((a, b) => a + b, 0);

// [Π reactant concentrations^order, Π product concentrations^order]
const terms = (rx, n, V) => {
  let f = 1;
  let p = 1;
  rx.nu.forEach((v, i) => {
    const c = Math.max(0, n[i]) / V;
    if (v < 0) f *= c ** -v;
    else p *= c ** v;
  });
  return [f, p];
};

/** Reaction quotient Q (same expression as K_C). Infinity with no reactant, NaN when nothing is present. */
export function quotient(s) {
  const [f, p] = terms(reactionOf(s), amounts(s), volume(s));
  return p / f;
}

const shifted = (rx, n, d) => n.map((x, i) => x + rx.nu[i] * d);
// extent of reaction (mol) the amounts allow: [most negative, most positive]
const limits = (rx, n) => {
  let lo = -Infinity;
  let hi = Infinity;
  rx.nu.forEach((v, i) => {
    if (v < 0) hi = Math.min(hi, n[i] / -v);
    else lo = Math.max(lo, -n[i] / v);
  });
  return [lo, hi];
};

// The net rate falls monotonically as the extent grows, so its zero is found by bisection.
// rate(a) ≥ 0 ≥ rate(b) is required.
const root = (rate, a, b) => {
  for (let i = 0; i < 80; i++) {
    const m = (a + b) / 2;
    if (rate(m) > 0) a = m;
    else b = m;
  }
  return (a + b) / 2;
};

/** Equilibrium amounts (mol) the current mixture is heading for, solved from Q = K_C directly. */
export function equilibrium(s) {
  const rx = reactionOf(s);
  const n = amounts(s);
  const V = volume(s);
  const K = kC(s);
  const [lo, hi] = limits(rx, n);
  const rate = d => {
    const [f, p] = terms(rx, shifted(rx, n, d), V);
    return f - p / K;
  };
  return shifted(rx, n, root(rate, lo, hi)).map(x => Math.max(0, x));
}

export function initialState() {
  return restart({
    reaction: "nh3",
    init1: 1, // mol put in at t = 0
    init2: 3,
    init3: 0,
    volume: 1, // L
    dT: 0, // K away from the reaction's middle temperature
    n1: 0, // mol now
    n2: 0,
    n3: 0,
    time: 0, // s
    xi: 0, // mol, net extent of reaction since the last disturbance (positive = forward)
    atEq: false,
    shift: 0, // direction of the last completed shift: 1 forward, −1 reverse, 0 none
    speed: 1, // playback speed
  });
}

/** A disturbance: the next equilibrium is a new one, and its shift is measured from now. */
export function disturb(s) {
  s.xi = 0;
  s.atEq = false;
  return s;
}

/** Start again at t = 0 from the chosen initial amounts. */
export function restart(s) {
  const rx = reactionOf(s);
  KEYS.forEach((k, i) => (s[k] = i < rx.nu.length ? clamp(s[INIT_KEYS[i]], 0, MAX_ADD) : 0));
  s.time = 0;
  s.shift = 0;
  return disturb(s);
}

/** After choosing another reaction: its default amounts, 1 L, middle temperature. */
export function selectReaction(s) {
  const rx = reactionOf(s);
  INIT_KEYS.forEach((k, i) => (s[k] = rx.init[i] ?? 0));
  s.volume = 1;
  s.dT = 0;
  return restart(s);
}

/** Add (delta > 0) or remove (delta < 0) some of species i. Returns the change actually made (mol). */
export function addAmount(s, i, delta) {
  const n = amounts(s);
  if (!(i >= 0 && i < n.length)) return 0;
  const next = delta > 0 ? Math.max(n[i], Math.min(MAX_ADD, n[i] + delta)) : Math.max(0, n[i] + delta);
  if (next === n[i]) return 0;
  s[KEYS[i]] = next;
  disturb(s);
  return next - n[i];
}

/** Total amount (mol) of atoms of each element in the vessel. */
export function elementTotals(s) {
  const rx = reactionOf(s);
  const totals = {};
  amounts(s).forEach((n, i) => {
    for (const [el, count] of Object.entries(rx.atoms[i])) totals[el] = (totals[el] ?? 0) + n * count;
  });
  return totals;
}

export function step(s, dt) {
  const rx = reactionOf(s);
  const V = volume(s);
  const K = kC(s);
  const n = amounts(s);
  const [lo, hi] = limits(rx, n);
  // rate of change of the extent of reaction, mol/s
  const rate = d => {
    const [f, p] = terms(rx, shifted(rx, n, d), V);
    return rx.kf * (f * Math.sqrt(K) - p / Math.sqrt(K)) * V;
  };
  const r0 = rate(0);
  let d = 0;
  if (r0 !== 0) {
    const euler = clamp(r0 * dt, lo, hi);
    // A step that would jump past equilibrium (stiff mixtures: small volume, high order) lands on it instead.
    if (rate(euler) * r0 < 0) d = r0 > 0 ? root(rate, 0, euler) : root(rate, euler, 0);
    else {
      d = clamp(rate(euler / 2) * dt, lo, hi); // midpoint rule
      if (d * r0 < 0 || rate(d) * r0 < 0) d = euler;
    }
  }
  shifted(rx, n, d).forEach((x, i) => (s[KEYS[i]] = Math.max(0, x)));
  s.xi += d;
  s.time += dt;
  if (!s.atEq) {
    const [f, p] = terms(rx, amounts(s), V);
    if (Math.abs(f - p / K) <= EQ_TOL * Math.max(f, p / K)) {
      s.atEq = true;
      s.shift = s.xi > SHIFT_EPS ? 1 : s.xi < -SHIFT_EPS ? -1 : 0;
    }
  }
  return s;
}
