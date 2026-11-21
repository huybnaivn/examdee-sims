// pH of everyday solutions under dilution, at 25 °C.
// ponytail: every solute is treated as a fully dissociated (strong) acid or base, so a tenfold
// dilution moves pH by exactly one unit until water's own ionisation takes over near 7.
// Weak acids and buffers (vinegar, blood) shift less in reality; add Ka per substance if that matters.

export const KW = 1e-14; // [H3O+]·[OH-], (mol/L)²

export const SOLUTIONS = [
  { id: "stomach", name: "Dịch vị dạ dày", pH: 1.5 },
  { id: "lemon", name: "Nước chanh", pH: 2.3 },
  { id: "vinegar", name: "Giấm ăn", pH: 2.9 },
  { id: "soda", name: "Nước ngọt có ga", pH: 3.0 },
  { id: "orange", name: "Nước cam", pH: 3.5 },
  { id: "coffee", name: "Cà phê đen", pH: 5.0 },
  { id: "rain", name: "Nước mưa", pH: 5.6 },
  { id: "milk", name: "Sữa tươi", pH: 6.6 },
  { id: "water", name: "Nước cất", pH: 7.0 },
  { id: "blood", name: "Máu", pH: 7.4 },
  { id: "sea", name: "Nước biển", pH: 8.1 },
  { id: "baking", name: "Dung dịch baking soda", pH: 8.3 },
  { id: "soap", name: "Nước xà phòng", pH: 10.0 },
  { id: "ammonia", name: "Dung dịch ammonia", pH: 11.5 },
  { id: "bleach", name: "Nước Javel", pH: 12.5 },
  { id: "drain", name: "Dung dịch thông cống (NaOH)", pH: 13.5 },
];

export const CAPACITY = 1500; // mL, beaker

export const initialState = () => ({
  solution: "lemon",
  solutionVolume: 100, // mL of the undiluted solution in the beaker
  waterVolume: 400, // mL of water added
});

export const solutionById = id => SOLUTIONS.find(x => x.id === id) ?? SOLUTIONS[0];

/** Excess of H3O+ over OH- (mol/L) in a solution of the given pH; negative for a base. */
export const excess = pH => 10 ** -pH - KW / 10 ** -pH;

/** [H3O+] (mol/L) when the solute contributes `c` mol/L net H3O+ and water stays in equilibrium: h − Kw/h = c. */
export function hydronium(c) {
  const root = Math.sqrt(c * c + 4 * KW);
  return c >= 0 ? (c + root) / 2 : KW / ((root - c) / 2); // avoid cancellation on the base side
}

/** pH, concentrations (mol/L) and dilution factor of the beaker's contents; null when it is empty. */
export function chemistry(s) {
  const total = s.solutionVolume + s.waterVolume;
  if (!(total > 0)) return null;
  const h = hydronium((excess(solutionById(s.solution).pH) * s.solutionVolume) / total);
  return { h, oh: KW / h, pH: -Math.log10(h), dilution: total / s.solutionVolume };
}

/** "acid" | "neutral" | "base". Neutral means 7 to the two decimals shown on screen. */
export const classify = pH => (Math.abs(pH - 7) < 0.005 ? "neutral" : pH < 7 ? "acid" : "base");
