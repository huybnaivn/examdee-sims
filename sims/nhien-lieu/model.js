// Fuels and combustion (KHTN 9). Each fuel is modelled as one pure substance CxHyOz.
// dH = heat released when 1 mol burns completely (kJ/mol), standard enthalpy of combustion
// at 25 °C with the water formed as a liquid (higher heating value).
// Atomic masses are the rounded school values: H = 1, C = 12, O = 16.

export const FUELS = {
  than: { short: "Than", label: "Than (coi là carbon C)", formula: "C", x: 1, y: 0, z: 0, dH: 393.5 },
  xang: { short: "Xăng", label: "Xăng (tính theo octane C₈H₁₈)", formula: "C8H18", x: 8, y: 18, z: 0, dH: 5470 },
  gas: { short: "Gas", label: "Khí gas (tính theo propane C₃H₈)", formula: "C3H8", x: 3, y: 8, z: 0, dH: 2220 },
  con: { short: "Cồn", label: "Cồn (ethanol C₂H₅OH)", formula: "C2H5OH", x: 2, y: 6, z: 1, dH: 1367 },
  hydro: { short: "H₂", label: "Hydrogen (H₂)", formula: "H2", x: 0, y: 2, z: 0, dH: 285.8 },
};
export const FUEL_IDS = Object.keys(FUELS);

export const DH_CO = 283.0; // kJ/mol, CO + ½O2 → CO2
export const DH_C = 393.5; // kJ/mol, C + O2 → CO2
export const DH_H2 = 285.8; // kJ/mol, H2 + ½O2 → H2O (liquid)
export const C_WATER = 4.2; // kJ/(kg·K), specific heat capacity of water
export const T_COLD = 20; // °C
export const T_HOT = 100; // °C
export const MOLAR_VOLUME = 24.79; // L/mol at 25 °C, 1 bar (đkc)
export const O2_IN_AIR = 0.21; // volume fraction of oxygen in air
export const BURN_TIME = 4; // s, length of the burning animation
export const AIR_MIN = 40;
export const AIR_MAX = 150;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const num = (v, fallback) => (Number.isFinite(v) ? v : fallback);

export const pretty = f => f.replace(/(?<=[A-Za-z)])\d+/g, d => [...d].map(c => "₀₁₂₃₄₅₆₇₈₉"[c]).join("")).replace("->", "→");

export const molarMass = f => 12 * f.x + f.y + 16 * f.z; // g/mol
/** Moles of O2 needed to burn 1 mol of fuel completely: CxHyOz + (x + y/4 − z/2) O2. */
export const oxygenPerMole = f => f.x + f.y / 4 - f.z / 2;
/** Heating value in kJ/g, which is the same number in MJ/kg. */
export const heatingValue = f => f.dH / molarMass(f);

/** Balanced complete-combustion equation with whole-number coefficients, plain digits. */
export function equation(f) {
  const o2 = oxygenPerMole(f);
  const k = Number.isInteger(o2) ? 1 : Number.isInteger(o2 * 2) ? 2 : 4;
  const term = (n, formula) => (n ? `${n === 1 ? "" : n}${formula}` : null);
  const right = [term(k * f.x, "CO2"), term((k * f.y) / 2, "H2O")].filter(Boolean);
  return `${term(k, f.formula)} + ${term(k * o2, "O2")} -> ${right.join(" + ")}`;
}

/**
 * Burn `mass` grams of fuel with `air` percent of the air needed for complete combustion.
 * Simple documented model for too little oxygen: the oxygen goes first to hydrogen (→ H2O),
 * then to carbon → CO, then CO → CO2. Carbon that gets no oxygen is left as soot;
 * hydrogen that gets none stays unburnt. The heat follows from Hess's law.
 */
export function burn(fuelId, mass, air) {
  const f = FUELS[fuelId] ?? FUELS.xang;
  const m = Math.max(0, num(mass, 0));
  const lambda = clamp(num(air, 100), AIR_MIN, AIR_MAX) / 100;
  const n = m / molarMass(f); // mol of fuel
  const need = oxygenPerMole(f); // mol O2 per mol fuel
  // everything below is per mole of fuel, counted in oxygen atoms
  let left = 2 * lambda * need + f.z;
  const h2o = Math.min(f.y / 2, left);
  left -= h2o;
  const oxidised = Math.min(f.x, left); // carbon that reaches at least CO
  left -= oxidised;
  const co2 = Math.min(oxidised, left);
  const co = oxidised - co2;
  const soot = f.x - oxidised;
  const h2 = f.y / 2 - h2o;
  const heat = n * (f.dH - co * DH_CO - soot * DH_C - h2 * DH_H2); // kJ
  const o2Supplied = n * need * lambda; // mol
  return {
    complete: lambda >= 1,
    moles: n,
    o2Needed: n * need, // mol
    o2Supplied,
    o2Used: n * need * Math.min(lambda, 1), // mol
    airVolume: (o2Supplied * MOLAR_VOLUME) / O2_IN_AIR, // L
    heat,
    co2: n * co2 * 44, // g
    co: n * co * 28, // g
    soot: n * soot * 12, // g
    h2o: n * h2o * 18, // g
    h2: n * h2 * 2, // g, unburnt hydrogen
    carbon: { co2: n * co2, co: n * co, soot: n * soot, fuel: n * f.x }, // mol of C
    water: heat / (C_WATER * (T_HOT - T_COLD)), // kg heated from T_COLD to T_HOT, no losses
  };
}

/** Complete combustion of 1 kg: heat (MJ), CO2 (kg) and CO2 per unit of heat (g/MJ = mg/kJ). */
export function perKg(fuelId) {
  const f = FUELS[fuelId];
  return { heat: heatingValue(f), co2: (44 * f.x) / molarMass(f), co2PerMJ: (44 * f.x * 1000) / f.dH };
}

export const leastCo2Fuel = () => FUEL_IDS.reduce((best, id) => (perKg(id).co2PerMJ < perKg(best).co2PerMJ ? id : best));

// ---------- state ----------
// progress 1 = the burn is finished (results on screen); compare = show the comparison charts;
// pick = the learner's answer to "which fuel gives the least CO2 for the same heat" ("" = none yet).
export const initialState = () => ({ fuel: "xang", mass: 100, air: 100, progress: 1, compare: false, pick: "" });

/** `progress` has no control, so it is clamped here: 0 = not lit, 1 = burnt out. */
export const progress = s => clamp(num(s.progress, 0), 0, 1);

/** Advance the burn; returns true on the step that finishes it. A finished burn starts again. */
export function step(s, dt) {
  const p = progress(s) >= 1 ? 0 : progress(s);
  s.progress = Math.min(1, p + dt / BURN_TIME);
  return s.progress >= 1;
}
