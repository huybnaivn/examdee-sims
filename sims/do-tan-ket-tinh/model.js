// Solubility against temperature, and crystallisation on cooling.
// Solubility S = grams of solute that saturate 100 g of water at a given temperature.

export const TEMPS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]; // °C

// Rounded handbook values, g of anhydrous solute per 100 g of water, at the temperatures in TEMPS.
// Between table points the curve is a straight line (linear interpolation).
export const SOLUTES = {
  KNO3: { formula: "KNO₃", name: "potassium nitrate", table: [13.3, 20.9, 31.6, 45.8, 63.9, 85.5, 110, 138, 169, 202, 246] },
  NaCl: { formula: "NaCl", name: "sodium chloride", table: [35.7, 35.8, 36.0, 36.3, 36.6, 37.0, 37.3, 37.8, 38.4, 39.0, 39.8] },
  CuSO4: { formula: "CuSO₄", name: "copper(II) sulfate", table: [14.3, 17.4, 20.7, 25.0, 28.5, 33.3, 40.0, 47.1, 55.0, 64.2, 75.4] },
  KCl: { formula: "KCl", name: "potassium chloride", table: [27.6, 31.0, 34.0, 37.0, 40.0, 42.6, 45.5, 48.3, 51.1, 54.0, 56.7] },
};

// Oxygen under a total pressure of 1 atm, in mg of O₂ per 100 g of water (note: milligrams).
export const GAS = { formula: "O₂", name: "khí oxygen", table: [6.94, 5.37, 4.34, 3.59, 3.08, 2.66, 2.27, 1.86, 1.38, 0.79, 0] };

export const LIMITS = { water: [50, 200], added: [0, 250], temp: [0, 100] };

export const initialState = () => ({
  solute: "KNO3",
  water: 100, // g
  added: 100, // g of solute put in
  t1: 60, // °C, temperature at which the solute is dissolved
  t2: 20, // °C, temperature afterwards (cooling when t2 < t1)
  seed: true, // crystals form as soon as the solution passes saturation; false: it stays supersaturated
  showGas: true,
  guess: 0, // g, the learner's prediction of the crystallised mass
  checked: true, // the crystallised mass is shown; any change of the experiment hides it again
});

const clamp = (v, [lo, hi]) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : lo));

function interpolate(table, t) {
  const x = clamp(t, LIMITS.temp) / 10;
  const i = Math.min(TEMPS.length - 2, Math.floor(x));
  return table[i] + (table[i + 1] - table[i]) * (x - i);
}

export const soluteOf = s => SOLUTES[s.solute] ?? SOLUTES.KNO3;
/** Solubility of a solid (g / 100 g water) at t °C. */
export const solubility = (key, t) => interpolate((SOLUTES[key] ?? SOLUTES.KNO3).table, t);
/** Solubility of O₂ (mg / 100 g water) at t °C and 1 atm. */
export const gasSolubility = t => interpolate(GAS.table, t);
/** Largest mass (g) that `water` g of water keeps dissolved at t °C. */
export const capacity = (key, water, t) => (solubility(key, t) * water) / 100;

export const STATUS = { unsaturated: 0, saturated: 1, supersaturated: 2 };

/**
 * The whole experiment: dissolve `added` g in `water` g at t1, then bring the solution to t2.
 * Masses in g. `crystallised` is what leaves the solution between t1 and t2.
 */
export function analyse(s) {
  const key = SOLUTES[s.solute] ? s.solute : "KNO3";
  const water = clamp(s.water, LIMITS.water);
  const added = clamp(s.added, LIMITS.added);
  const s1 = solubility(key, s.t1);
  const s2 = solubility(key, s.t2);
  const cap1 = (s1 * water) / 100;
  const cap2 = (s2 * water) / 100;
  const dissolved1 = Math.min(added, cap1);
  const undissolved1 = added - dissolved1; // never dissolved at t1; it also acts as seed crystal
  // Without any crystal to start on, a solution cooled below saturation can stay supersaturated.
  const supersaturated = !s.seed && undissolved1 === 0 && dissolved1 > cap2;
  const dissolved = supersaturated ? dissolved1 : Math.min(added, cap2);
  const crystallised = Math.max(0, dissolved1 - dissolved);
  const status = supersaturated ? STATUS.supersaturated : added >= cap2 ? STATUS.saturated : STATUS.unsaturated;
  return { key, water, added, s1, s2, cap1, cap2, dissolved1, undissolved1, dissolved, solid: added - dissolved, crystallised, status };
}

/** A prediction counts when it is within 1 g or 3 % of the true mass, whichever is larger. */
export const predictionOk = (guess, mass) => mass > 0 && Math.abs(guess - mass) <= Math.max(1, 0.03 * mass);
