// Dissolving a solid in water at 25 °C.
// Conventions (also stated on screen): water has D = 1 g/mL, and the volume of the solution is
// taken to be the volume of the water, as in school exercises.

// molarMass in g/mol; solubility in g of (anhydrous) solute per 100 g of water at 25 °C, rounded.
// tint: how strongly one mol/L colours the solution (0 = colourless).
export const SOLUTES = {
  nacl: { formula: "NaCl", name: "muối ăn", molarMass: 58.5, solubility: 36, rgb: [150, 170, 190], tint: 0, solid: "#ffffff" },
  saccharose: { formula: "C₁₂H₂₂O₁₁", name: "đường saccharose", molarMass: 342, solubility: 207, rgb: [150, 170, 190], tint: 0, solid: "#fffdf2" },
  cuso4: { formula: "CuSO₄", name: "copper(II) sulfate", molarMass: 160, solubility: 22, rgb: [23, 111, 224], tint: 1.1, solid: "#2a62c9" },
  kmno4: { formula: "KMnO₄", name: "thuốc tím", molarMass: 158, solubility: 7.6, rgb: [122, 16, 128], tint: 9, solid: "#3a123f" },
  naoh: { formula: "NaOH", name: "sodium hydroxide", molarMass: 40, solubility: 100, rgb: [150, 170, 190], tint: 0, solid: "#ffffff" },
};

export const LIMITS = { added: [0, 300], water: [20, 500] };
export const WATER_STEP = 20; // mL per press of the evaporate / add-water buttons

export const initialState = () => ({
  solute: "cuso4",
  added: 20, // g of solute put in the beaker (dissolved or not)
  water: 200, // mL of water = g of water
  saturationReported: false, // the saturation goal has fired this session; reset re-arms it
});

const clamp = (v, [lo, hi]) => Math.min(hi, Math.max(lo, v));
export const soluteOf = s => SOLUTES[s.solute] ?? SOLUTES.cuso4;

/** Largest mass of solute (g) that `water` mL of water dissolves at 25 °C. */
export const maxDissolved = (solute, water) => (solute.solubility * water) / 100;

/** All amounts in the beaker. Masses in g, volume in L, cM in mol/L, cPercent in %. */
export function solution(s) {
  const solute = soluteOf(s);
  const added = Math.max(0, s.added);
  const water = Math.max(0, s.water);
  const cap = maxDissolved(solute, water);
  const dissolved = Math.min(added, cap);
  const solid = added - dissolved; // undissolved excess at the bottom
  const mass = dissolved + water; // the solid at the bottom is not part of the solution
  const mol = dissolved / solute.molarMass;
  const volume = water / 1000;
  return {
    solute,
    cap,
    dissolved,
    solid,
    mass,
    mol,
    volume,
    cPercent: mass > 0 ? (dissolved / mass) * 100 : 0, // C% = m_ct / m_dd · 100%
    cM: volume > 0 ? mol / volume : 0, // C_M = n / V
    saturated: added > 0 && added >= cap - 1e-9,
  };
}

/** 0 (colourless) … 1 (deepest): the colour deepens with concentration and levels off. */
export const colorDepth = s => 1 - Math.exp(-soluteOf(s).tint * solution(s).cM);

export function addWater(s, mL = WATER_STEP) {
  s.water = clamp(s.water + mL, LIMITS.water);
  return s;
}

export const evaporate = (s, mL = WATER_STEP) => addWater(s, -mL);

/**
 * Call when the amounts have settled. Returns true the first time the solution is saturated in this
 * session (until reset), so the goal is reported once, not on every crossing.
 */
export function crossedIntoSaturation(s) {
  if (s.saturationReported || !solution(s).saturated) return false;
  s.saturationReported = true;
  return true;
}
