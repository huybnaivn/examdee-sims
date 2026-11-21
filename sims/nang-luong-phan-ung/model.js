// Reaction enthalpy at standard conditions (298 K, 1 bar): from enthalpies of formation and from bond energies.

// Average bond energies (kJ/mol), gas phase.
export const BOND = { "H–H": 436, "O=O": 498, "Cl–Cl": 243, "H–Cl": 432, "N≡N": 945, "N–H": 391, "C–H": 414, "C=O": 799, "O–H": 464 };

// s: [formula, physical state, coefficient, ΔfH° (kJ/mol)]
// bonds: bonds broken in the reactants and formed in the products (only for all-gas reactions).
// ref: index of the reactant whose amount the learner sets; molar: its molar mass (g/mol).
// ea: activation energy used for the diagram only (illustrative, kJ/mol).
export const REACTIONS = [
  {
    id: "ch4",
    name: "Đốt cháy methane",
    reactants: [["CH₄", "g", 1, -74.6], ["O₂", "g", 2, 0]],
    products: [["CO₂", "g", 1, -393.5], ["H₂O", "g", 2, -241.8]],
    bonds: { broken: { "C–H": 4, "O=O": 2 }, formed: { "C=O": 2, "O–H": 4 } },
    ref: 0, molar: 16, ea: 250,
  },
  {
    id: "h2o",
    name: "Đốt cháy hydrogen",
    reactants: [["H₂", "g", 2, 0], ["O₂", "g", 1, 0]],
    products: [["H₂O", "g", 2, -241.8]],
    bonds: { broken: { "H–H": 2, "O=O": 1 }, formed: { "O–H": 4 } },
    ref: 0, molar: 2, ea: 200,
  },
  {
    id: "nh3",
    name: "Tổng hợp ammonia",
    reactants: [["N₂", "g", 1, 0], ["H₂", "g", 3, 0]],
    products: [["NH₃", "g", 2, -45.9]],
    bonds: { broken: { "N≡N": 1, "H–H": 3 }, formed: { "N–H": 6 } },
    ref: 0, molar: 28, ea: 230,
  },
  {
    id: "hcl",
    name: "Hydrogen tác dụng với chlorine",
    reactants: [["H₂", "g", 1, 0], ["Cl₂", "g", 1, 0]],
    products: [["HCl", "g", 2, -92.3]],
    bonds: { broken: { "H–H": 1, "Cl–Cl": 1 }, formed: { "H–Cl": 2 } },
    ref: 0, molar: 2, ea: 160,
  },
  {
    id: "caco3",
    name: "Nhiệt phân đá vôi",
    reactants: [["CaCO₃", "s", 1, -1206.9]],
    products: [["CaO", "s", 1, -635.1], ["CO₂", "g", 1, -393.5]],
    bonds: null,
    ref: 0, molar: 100, ea: 260,
  },
  {
    id: "nh4no3",
    name: "Hòa tan ammonium nitrate vào nước",
    reactants: [["NH₄NO₃", "s", 1, -365.6]],
    products: [["NH₄⁺", "aq", 1, -132.5], ["NO₃⁻", "aq", 1, -205.0]],
    bonds: null,
    ref: 0, molar: 80, ea: 60,
  },
];

export const reactionById = id => REACTIONS.find(r => r.id === id) ?? REACTIONS[0];
const round1 = x => Math.round(x * 10) / 10; // ΔfH° data have one decimal

const sumH = list => list.reduce((h, [, , k, dfh]) => h + k * dfh, 0);
/** ΔrH° = ΣΔfH°(products) − ΣΔfH°(reactants), kJ for the equation as written. */
export const deltaH = r => round1(sumH(r.products) - sumH(r.reactants));
const sumE = bonds => Object.entries(bonds).reduce((e, [b, k]) => e + k * BOND[b], 0);
/** ΔrH ≈ ΣEb(broken, reactants) − ΣEb(formed, products), or null when not all species are gases. */
export const bondEstimate = r => (r.bonds ? sumE(r.bonds.broken) - sumE(r.bonds.formed) : null);
/** Heat for `amount` mol of the reference reactant (kJ). */
export const scaledH = (r, amount) => (deltaH(r) * amount) / r.reactants[r.ref][2];
export const isExo = dH => dH < 0;

/** Energy profile for the diagram; a catalyst lowers Eₐ and leaves ΔrH unchanged. */
export function profile(r, catalyst) {
  const dH = deltaH(r);
  const floor = Math.max(dH, 0); // the peak must stay above both levels
  return { dH, ea: catalyst ? floor + 0.5 * (r.ea - floor) : r.ea };
}

export function initialState() {
  return { reaction: "ch4", amount: 1, catalyst: false, showBonds: true, quiz: false };
}

/** A different reaction for the next quiz question. */
export function nextQuestion(current, rand = Math.random) {
  const others = REACTIONS.filter(r => r.id !== current);
  return others[Math.min(others.length - 1, Math.floor(rand() * others.length))].id;
}
