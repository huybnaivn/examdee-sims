// Chất hết, chất dư và hiệu suất phản ứng (Hóa học, CT 2018). Pure logic.

// Atomic masses as rounded in Vietnamese school textbooks (Cl = 35,5).
export const ATOMIC_MASS = { H: 1, C: 12, N: 14, O: 16, Al: 27, S: 32, Cl: 35.5, Ca: 40, Fe: 56, Zn: 65 };

// Two reactants each; `main` is the product whose theoretical / actual amount is reported.
export const REACTIONS = [
  { id: "h2-o2", left: [["H2", 2], ["O2", 1]], right: [["H2O", 2]], main: 0, arrow: "→", cond: "t°" },
  { id: "n2-h2", left: [["N2", 1], ["H2", 3]], right: [["NH3", 2]], main: 0, arrow: "⇌", cond: "t°, p, xt" },
  { id: "fe-s", left: [["Fe", 1], ["S", 1]], right: [["FeS", 1]], main: 0, arrow: "→", cond: "t°" },
  { id: "caco3-hcl", left: [["CaCO3", 1], ["HCl", 2]], right: [["CaCl2", 1], ["CO2", 1], ["H2O", 1]], main: 1, arrow: "→", cond: "" },
  { id: "zn-hcl", left: [["Zn", 1], ["HCl", 2]], right: [["ZnCl2", 1], ["H2", 1]], main: 1, arrow: "→", cond: "" },
  { id: "ch4-o2", left: [["CH4", 1], ["O2", 2]], right: [["CO2", 1], ["H2O", 2]], main: 0, arrow: "→", cond: "t°" },
  { id: "al-o2", left: [["Al", 4], ["O2", 3]], right: [["Al2O3", 2]], main: 0, arrow: "→", cond: "t°" },
];
export const reactionIndex = id => Math.max(0, REACTIONS.findIndex(r => r.id === id));
export const reactionById = id => REACTIONS[reactionIndex(id)];

export function parseFormula(formula) {
  const counts = {};
  for (const m of formula.matchAll(/([A-Z][a-z]?)(\d*)/g)) counts[m[1]] = (counts[m[1]] ?? 0) + Number(m[2] || 1);
  return counts;
}
export const molarMass = f => Object.entries(parseFormula(f)).reduce((m, [el, n]) => m + ATOMIC_MASS[el] * n, 0);
const SUB = "₀₁₂₃₄₅₆₇₈₉";
export const pretty = f => f.replace(/\d/g, d => SUB[d]);
export const equationText = r => {
  const side = list => list.map(([f, nu]) => `${nu > 1 ? nu : ""}${pretty(f)}`).join(" + ");
  return `${side(r.left)} ${r.arrow} ${side(r.right)}`;
};

export const MOL_MAX = 10;
export const MASS_MAX = 200;
export const initialState = () => ({ reaction: "h2-o2", unit: "mol", n1: 3, n2: 2, m1: 6, m2: 64, yield: 80 });

/** Amounts of the two reactants in mol, from either the mol or the gram sliders. */
export function amounts(s) {
  const r = reactionById(s.reaction);
  const ok = v => (Number.isFinite(v) && v > 0 ? v : 0); // forged negatives / NaN mean "none"
  if (s.unit === "g") return r.left.map(([f], i) => ok(Math.min(MASS_MAX, s[`m${i + 1}`])) / molarMass(f));
  return r.left.map((_, i) => ok(Math.min(MOL_MAX, s[`n${i + 1}`])));
}

const close = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

/**
 * The whole calculation. n: reactant amounts (mol); H: yield (0..1).
 * limiting: index of the reactant used up first, -1 when both are used up exactly (vừa đủ).
 * extent: mol of "reaction units" if complete (ξ = min nᵢ/νᵢ); actual extent = H·ξ.
 */
export function solve(r, n, H) {
  const ratios = r.left.map(([, nu], i) => n[i] / nu);
  const extent = Math.min(...ratios);
  const limiting = close(ratios[0], ratios[1]) ? -1 : ratios[0] < ratios[1] ? 0 : 1;
  const h = Math.min(1, Math.max(0, H));
  const leftComplete = r.left.map(([, nu], i) => (limiting === -1 || i === limiting ? 0 : n[i] - nu * extent));
  const leftActual = r.left.map(([, nu], i) => Math.max(0, n[i] - nu * extent * h));
  const theoretical = r.right.map(([, nu]) => nu * extent);
  const actual = theoretical.map(x => x * h);
  const mass = (list, amts) => list.reduce((m, [f], i) => m + amts[i] * molarMass(f), 0);
  return {
    ratios,
    extent,
    limiting,
    leftComplete,
    leftActual,
    theoretical,
    actual,
    massBefore: mass(r.left, n),
    massAfter: mass(r.left, leftActual) + mass(r.right, actual),
    main: { theoretical: theoretical[r.main], actual: actual[r.main], M: molarMass(r.right[r.main][0]) },
  };
}

export const solveState = s => solve(reactionById(s.reaction), amounts(s), s.yield / 100);

/** Yield from an actual and a theoretical amount, in %. */
export const yieldPercent = (actual, theoretical) => (theoretical > 0 ? (actual / theoretical) * 100 : 0);
