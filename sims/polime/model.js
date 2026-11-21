// Polymers from monomers: repeating unit, degree of polymerisation n and polymer molar mass.
// Atomic masses as in Vietnamese school textbooks.

export const MASS = { C: 12, H: 1, O: 16, N: 14, Cl: 35.5 };
export const WATER = 18;
export const N_MIN = 100;
export const N_MAX = 20000;
export const N_STEP = 100;

export function parseFormula(f) {
  const counts = {};
  for (const [, el, k] of f.matchAll(/([A-Z][a-z]?)(\d*)/g)) counts[el] = (counts[el] ?? 0) + (k ? Number(k) : 1);
  return counts;
}
export const molarMass = f => Object.entries(parseFormula(f)).reduce((m, [el, k]) => m + MASS[el] * k, 0);

// monomers: formulas whose masses add up to one repeating unit (before water is lost).
// unit: the repeating unit's formula; water: H2O released per repeating unit (textbook convention, chain ends ignored).
export const POLYMERS = [
  { id: "pe", monomers: [{ name: "ethylene", formula: "C2H4", struct: "CH₂=CH₂" }], unit: "C2H4", water: 0, polymer: "polyethylene (PE)", repeat: "–CH₂–CH₂–" },
  { id: "pp", monomers: [{ name: "propylene", formula: "C3H6", struct: "CH₂=CH–CH₃" }], unit: "C3H6", water: 0, polymer: "polypropylene (PP)", repeat: "–CH₂–CH(CH₃)–" },
  { id: "pvc", monomers: [{ name: "vinyl chloride", formula: "C2H3Cl", struct: "CH₂=CHCl" }], unit: "C2H3Cl", water: 0, polymer: "poly(vinyl chloride) (PVC)", repeat: "–CH₂–CHCl–" },
  { id: "ps", monomers: [{ name: "styrene", formula: "C8H8", struct: "CH₂=CH–C₆H₅" }], unit: "C8H8", water: 0, polymer: "polystyrene (PS)", repeat: "–CH₂–CH(C₆H₅)–" },
  { id: "capron", monomers: [{ name: "caprolactam", formula: "C6H11NO", struct: "vòng –NH–[CH₂]₅–CO–" }], unit: "C6H11NO", water: 0, polymer: "capron (nylon-6)", repeat: "–NH–[CH₂]₅–CO–", ring: true },
  { id: "buna", monomers: [{ name: "buta-1,3-diene", formula: "C4H6", struct: "CH₂=CH–CH=CH₂" }], unit: "C4H6", water: 0, polymer: "polybuta-1,3-diene (cao su buna)", repeat: "–CH₂–CH=CH–CH₂–" },
  {
    id: "nylon66",
    monomers: [
      { name: "hexamethylenediamine", formula: "C6H16N2", struct: "H₂N–[CH₂]₆–NH₂" },
      { name: "adipic acid", formula: "C6H10O4", struct: "HOOC–[CH₂]₄–COOH" },
    ],
    unit: "C12H22N2O2",
    water: 2,
    polymer: "nylon-6,6",
    repeat: "–NH–[CH₂]₆–NH–CO–[CH₂]₄–CO–",
  },
];

export const polymerById = id => POLYMERS.find(p => p.id === id) ?? POLYMERS[0];
export const isCondensation = p => p.water > 0;
/** Mass of all monomers that make one repeating unit (g/mol). */
export const monomerMass = p => p.monomers.reduce((m, x) => m + molarMass(x.formula), 0);
/** Mass of one repeating unit: monomers minus the water released (g/mol). */
export const unitMass = p => monomerMass(p) - p.water * WATER;
/** Polymer molar mass M = n × unit mass (g/mol). */
export const polymerMass = (p, n) => n * unitMass(p);
/** Degree of polymerisation from the polymer molar mass. */
export const degreeFromMass = (p, M) => M / unitMass(p);
/** Water released when n repeating units form (mol per mol polymer). */
export const waterReleased = (p, n) => p.water * n;

export const SHOW = 8; // monomers drawn joining in the animation

export function initialState() {
  return { polymer: "pvc", n: 2000, quiz: false, targetN: 1500, progress: SHOW };
}

/** Joining animation: loops while playing. */
export function step(s, dt) {
  s.progress = (Number.isFinite(s.progress) ? s.progress : 0) + dt * 1.6;
  if (s.progress > SHOW + 1.5) s.progress = 0;
}

/** Quiz target from untrusted state: a multiple of N_STEP inside the slider range. */
export const targetOf = s => Math.min(N_MAX, Math.max(N_MIN, Math.round((Number(s.targetN) || N_MIN) / N_STEP) * N_STEP));
export const newTarget = (rand = Math.random) => N_MIN * 5 + N_STEP * Math.floor(rand() * ((N_MAX - N_MIN * 5) / N_STEP + 1));
