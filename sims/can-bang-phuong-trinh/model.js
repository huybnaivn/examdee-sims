// Balancing chemical equations. Formulas are plain ASCII ("Fe(OH)3"); pretty() adds subscripts for display.

export const MAX = 10; // largest coefficient a stepper allows

export const REACTIONS = [
  { id: "h2-o2", left: ["H2", "O2"], right: ["H2O"], solution: [2, 1, 2] },
  { id: "n2-h2", left: ["N2", "H2"], right: ["NH3"], solution: [1, 3, 2] },
  { id: "ch4-o2", left: ["CH4", "O2"], right: ["CO2", "H2O"], solution: [1, 2, 1, 2] },
  { id: "fe-o2", left: ["Fe", "O2"], right: ["Fe3O4"], solution: [3, 2, 1] },
  { id: "al-hcl", left: ["Al", "HCl"], right: ["AlCl3", "H2"], solution: [2, 6, 2, 3] },
  { id: "p-o2", left: ["P", "O2"], right: ["P2O5"], solution: [4, 5, 2] },
  { id: "al-o2", left: ["Al", "O2"], right: ["Al2O3"], solution: [4, 3, 2] },
  { id: "kclo3", left: ["KClO3"], right: ["KCl", "O2"], solution: [2, 2, 3] },
  { id: "na-h2o", left: ["Na", "H2O"], right: ["NaOH", "H2"], solution: [2, 2, 2, 1] },
  { id: "zn-hcl", left: ["Zn", "HCl"], right: ["ZnCl2", "H2"], solution: [1, 2, 1, 1] },
  { id: "fe2o3-co", left: ["Fe2O3", "CO"], right: ["Fe", "CO2"], solution: [1, 3, 2, 3] },
  { id: "feoh3", left: ["Fe(OH)3"], right: ["Fe2O3", "H2O"], solution: [2, 1, 3] },
  { id: "c2h5oh-o2", left: ["C2H5OH", "O2"], right: ["CO2", "H2O"], solution: [1, 3, 2, 3] },
];

export const initialState = () => ({ reaction: "ch4-o2", c1: 1, c2: 1, c3: 1, c4: 1 });

export const reactionById = id => REACTIONS.find(r => r.id === id) ?? REACTIONS[0];
export const species = r => [...r.left, ...r.right];
/** The coefficients in use for reaction r, in the order of species(r). */
export const coefficients = (s, r) => [s.c1, s.c2, s.c3, s.c4].slice(0, species(r).length);

const SUB = "₀₁₂₃₄₅₆₇₈₉";
export const pretty = formula => formula.replace(/\d/g, d => SUB[d]);

/** "Fe(OH)3" -> { Fe: 1, O: 3, H: 3 }. Throws on anything that is not a formula. */
export function parseFormula(formula) {
  const stack = [{}];
  const add = (el, n) => {
    const top = stack[stack.length - 1];
    top[el] = (top[el] ?? 0) + n;
  };
  const token = /([A-Z][a-z]*)(\d*)|(\()|\)(\d*)/y;
  let m;
  let end = 0;
  while ((m = token.exec(formula))) {
    end = token.lastIndex;
    if (m[1]) add(m[1], Number(m[2] || 1));
    else if (m[3]) stack.push({});
    else {
      if (stack.length < 2) throw new Error(`Unbalanced ")" in ${formula}`);
      const group = stack.pop();
      for (const [el, n] of Object.entries(group)) add(el, n * Number(m[4] || 1));
    }
  }
  if (!formula || end !== formula.length || stack.length !== 1) throw new Error(`Bad formula: ${formula}`);
  return stack[0];
}

const sideCounts = (formulas, coeffs) => {
  const total = {};
  formulas.forEach((f, i) => {
    for (const [el, n] of Object.entries(parseFormula(f))) total[el] = (total[el] ?? 0) + n * coeffs[i];
  });
  return total;
};

/** Atoms of each element on each side for the given coefficients. */
export const atomCounts = (r, coeffs) => ({
  left: sideCounts(r.left, coeffs),
  right: sideCounts(r.right, coeffs.slice(r.left.length)),
});

/** Elements in order of first appearance. */
export const elements = r => [...new Set(species(r).flatMap(f => Object.keys(parseFormula(f))))];

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
export const gcdAll = coeffs => coeffs.reduce(gcd);

/** "balanced" (smallest whole numbers), "multiple" (balanced but reducible) or "unbalanced". */
export function status(r, coeffs) {
  if (coeffs.length !== species(r).length || !coeffs.every(c => Number.isInteger(c) && c > 0)) return "unbalanced";
  const { left, right } = atomCounts(r, coeffs);
  if (!elements(r).every(el => left[el] === right[el])) return "unbalanced";
  return gcdAll(coeffs) === 1 ? "balanced" : "multiple";
}
