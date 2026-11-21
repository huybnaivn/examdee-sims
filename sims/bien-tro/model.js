// Rheostat in series with a bulb, and a potentiometer used as a voltage divider.
// Ideal source, ideal meters. The bulb's resistance is taken as constant (its change with
// temperature is ignored). Volts, ohms, amperes, watts.

export const BULB = { u: 6, p: 3 }; // rated 6 V – 3 W
export const R_BULB = BULB.u ** 2 / BULB.p; // 12 Ω
export const I_RATED = BULB.p / BULB.u; // 0,5 A
export const RATED_TOL = 0.03; // within ±3 % of the rated current counts as rated brightness

export const initialState = () => ({
  mode: "rheostat", // "rheostat" | "divider"
  voltage: 9, // V
  rMax: 20, // Ω, the whole coil
  position: 100, // %, share of the coil length in use (rheostat) or below the slider (divider)
  loaded: false, // divider: a load is connected across the output
  rLoad: 20, // Ω
});

const share = s => Math.min(100, Math.max(0, s.position)) / 100;

/** Rheostat resistance: proportional to the coil length in use, R_b = R_max·ℓ/ℓ_max. */
export const rheostatR = s => share(s) * s.rMax;

/** Rheostat in series with the bulb: I = U / (R_đ + R_b). */
export function rheostat(s) {
  const rb = rheostatR(s);
  const i = s.voltage / (R_BULB + rb);
  return { rb, i, uBulb: i * R_BULB, uRheostat: i * rb, pBulb: i * i * R_BULB };
}

/**
 * Potentiometer across the source: R₂ is the part below the slider, R₁ the rest.
 * Unloaded: U_ra = U·R₂/(R₁ + R₂). A load R_t in parallel with R₂ pulls the output down.
 */
export function divider(s) {
  const r2 = share(s) * s.rMax;
  const r1 = s.rMax - r2;
  const lower = s.loaded ? (r2 * s.rLoad) / (r2 + s.rLoad) : r2;
  const i = s.voltage / (r1 + lower); // from the source
  const uOut = i * lower;
  return { r1, r2, i, uOut, unloaded: (s.voltage * r2) / s.rMax, iLoad: s.loaded ? uOut / s.rLoad : 0 };
}

/** Bulb brightness 0..1, 1 at rated power (it may exceed 1 when overdriven). */
export const brightness = pBulb => pBulb / BULB.p;

export const isRated = s => s.mode === "rheostat" && Math.abs(rheostat(s).i / I_RATED - 1) <= RATED_TOL;
