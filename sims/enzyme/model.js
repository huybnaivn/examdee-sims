// Enzyme activity: Michaelis–Menten kinetics with temperature and pH effects.
//
//   v = V_max · [S] / (K_m + [S])                 mmol/L of product per minute
//   V_max = k · E · f_T(T) · f_pH(pH) · a          k = 1 mmol/L/phút per unit of enzyme
//   f_T  = 2^((T − 37)/10) up to the optimum 37 °C (Q10 = 2), then 1 − (T − 37)/30 above it
//   f_pH = exp(−((pH − pH_opt)/1,5)²)              pH_opt per enzyme, reversible
//   a    = fraction of the enzyme molecules not denatured (0 to 1). Heating above 45 °C denatures
//          for good: a can only fall, to at most d(T) = 1 − (T − 45)/15 (all gone at 60 °C).
//          Cooling down never raises it again; only fresh enzyme does. Heat is applied by
//          denature() when the learner sets a temperature; until then activeNow() already caps a.
// The reaction runs in a closed beaker: d[S]/dt = −v, [P] = [S]₀ − [S].
// K_m and k are illustrative values, not measured constants of these enzymes.

export const T_OPT = 37; // °C, human enzymes
export const T_DENATURE = 45; // °C, irreversible denaturation starts here
export const T_DEAD = 60; // °C, all molecules denatured
export const K_CAT = 1; // mmol/L per minute per unit of enzyme
export const T_END = 30; // minutes of reaction shown

export const ENZYMES = {
  amylase: { label: "Amylase (nước bọt)", pH: 6.8, Km: 4, substrate: "tinh bột", product: "đường maltose" },
  pepsin: { label: "Pepsin (dạ dày)", pH: 2, Km: 2, substrate: "protein", product: "chuỗi peptide ngắn" },
  trypsin: { label: "Trypsin (ruột non)", pH: 8, Km: 1, substrate: "protein", product: "chuỗi peptide ngắn" },
};
export const RANGES = { temp: [0, 70], pH: [0, 14], substrate: [0, 20], amount: [0, 5] };

export const initialState = () => ({
  enzyme: "amylase",
  temp: 37, // °C
  pH: 7,
  substrate: 10, // initial substrate concentration, mmol/L
  amount: 1, // amount of enzyme, units
  active: 1, // fraction of enzyme not denatured
  time: 0, // minutes since the reaction started
  S: 10, // substrate left, mmol/L
  curve: "substrate", // rate graph: "substrate" | "temp" | "pH"
});

const num = (v, [lo, hi]) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : lo));
export const enzymeOf = s => ENZYMES[s.enzyme] ?? ENZYMES.amylase;

export const tempFactor = T => (T <= T_OPT ? 2 ** ((T - T_OPT) / 10) : Math.max(0, 1 - (T - T_OPT) / 30));
export const pHFactor = (pH, opt) => Math.exp(-(((pH - opt) / 1.5) ** 2));
/** Largest fraction of enzyme that can still be active after being held at T. */
export const survival = T => Math.min(1, Math.max(0, 1 - (T - T_DENATURE) / (T_DEAD - T_DENATURE)));

/** Fraction of the enzyme active now: what heating has left, and no more than T allows. */
export const activeNow = s => Math.min(num(s.active, [0, 1]), survival(num(s.temp, RANGES.temp)));

export const vmax = s =>
  K_CAT * num(s.amount, RANGES.amount) * tempFactor(num(s.temp, RANGES.temp)) * pHFactor(num(s.pH, RANGES.pH), enzymeOf(s).pH) * activeNow(s);

/** Rate v at substrate concentration S (default: the initial concentration). */
export const rate = (s, S = num(s.substrate, RANGES.substrate)) => (vmax(s) * S) / (enzymeOf(s).Km + S);

/** v / V_max = [S] / (K_m + [S]): the fraction of enzyme molecules holding a substrate. */
export const saturation = (s, S = num(s.substrate, RANGES.substrate)) => S / (enzymeOf(s).Km + S);

/** Apply the heat of the current temperature. Returns true if some enzyme was just denatured. */
export function denature(s) {
  const a = activeNow(s);
  const dropped = a < num(s.active, [0, 1]) - 1e-12;
  s.active = a;
  return dropped;
}

/** Start the reaction again from the initial substrate concentration. */
export function restart(s) {
  s.time = 0;
  s.S = num(s.substrate, RANGES.substrate);
}

/** Advance by dt minutes (RK4 on d[S]/dt = −v). */
export function step(s, dt) {
  const S0 = num(s.substrate, RANGES.substrate);
  const f = S => -rate(s, Math.max(0, S));
  const S = num(s.S, [0, S0]);
  const k1 = f(S);
  const k2 = f(S + (dt / 2) * k1);
  const k3 = f(S + (dt / 2) * k2);
  const k4 = f(S + dt * k3);
  s.S = Math.max(0, S + (dt / 6) * (k1 + 2 * k2 + 2 * k3 + k4));
  s.time = Math.min(T_END, (Number.isFinite(s.time) ? s.time : 0) + dt);
  return s;
}

/** Product formed so far, mmol/L. */
export const product = s => num(s.substrate, RANGES.substrate) - num(s.S, [0, num(s.substrate, RANGES.substrate)]);

/** The whole run as [[t, P], ...], from a copy started at t = 0. */
export function trajectory(s, dt = 0.05) {
  const c = { ...s };
  restart(c);
  const out = [[0, 0]];
  while (c.time < T_END - 1e-9) {
    step(c, dt);
    out.push([c.time, product(c)]);
  }
  return out;
}
