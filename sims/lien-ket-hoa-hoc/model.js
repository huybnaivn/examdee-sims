// Ionic and covalent bonds between two of ten elements (Hóa học 10, chương trình 2018).
// Bond type from the Pauling electronegativity difference Δχ, with the textbook thresholds:
//   Δχ < 0,4: cộng hóa trị không phân cực; 0,4 ≤ Δχ < 1,7: cộng hóa trị phân cực; Δχ ≥ 1,7: ion.

// valenceE: electrons in the outer shell. valence: hóa trị (ionic charge for metals, bonds for non-metals).
// shells: electrons per shell. noble: the noble gas with the same outer shell after the bond.
export const ELEMENTS = {
  H: { name: "Hydrogen", chi: 2.2, metal: false, valenceE: 1, valence: 1, shells: [1], noble: "He" },
  C: { name: "Carbon", chi: 2.55, metal: false, valenceE: 4, valence: 4, shells: [2, 4], noble: "Ne" },
  N: { name: "Nitrogen", chi: 3.04, metal: false, valenceE: 5, valence: 3, shells: [2, 5], noble: "Ne" },
  O: { name: "Oxygen", chi: 3.44, metal: false, valenceE: 6, valence: 2, shells: [2, 6], noble: "Ne" },
  F: { name: "Fluorine", chi: 3.98, metal: false, valenceE: 7, valence: 1, shells: [2, 7], noble: "Ne" },
  Na: { name: "Sodium", chi: 0.93, metal: true, valenceE: 1, valence: 1, shells: [2, 8, 1], noble: "Ne" },
  Mg: { name: "Magnesium", chi: 1.31, metal: true, valenceE: 2, valence: 2, shells: [2, 8, 2], noble: "Ne" },
  Cl: { name: "Chlorine", chi: 3.16, metal: false, valenceE: 7, valence: 1, shells: [2, 8, 7], noble: "Ar" },
  K: { name: "Potassium", chi: 0.82, metal: true, valenceE: 1, valence: 1, shells: [2, 8, 8, 1], noble: "Ar" },
  Ca: { name: "Calcium", chi: 1.0, metal: true, valenceE: 2, valence: 2, shells: [2, 8, 8, 2], noble: "Ar" },
};
export const SYMBOLS = ["H", "C", "N", "O", "F", "Na", "Mg", "Cl", "K", "Ca"];

export const THRESHOLDS = { polar: 0.4, ionic: 1.7 };
// Codes used in events: 0 non-polar covalent, 1 polar covalent, 2 ionic.
export const TYPES = ["nonpolar", "polar", "ionic"];
export const TYPE_NAMES = { nonpolar: "Liên kết cộng hóa trị không phân cực", polar: "Liên kết cộng hóa trị phân cực", ionic: "Liên kết ion" };

/** |χA − χB|, rounded to 2 decimals as in the textbook tables (so 3,16 − 2,20 is 0,96, not 0,9600000000000002). */
export const deltaChi = (a, b) => Math.round(Math.abs(ELEMENTS[a].chi - ELEMENTS[b].chi) * 100) / 100;

/** Bond type from Δχ alone, by the textbook thresholds. */
export const classify = d => (d < THRESHOLDS.polar ? "nonpolar" : d < THRESHOLDS.ionic ? "polar" : "ionic");

// The compounds this sim draws, one per supported pair, with their names.
export const COMPOUNDS = [
  ["H2", "Hydrogen"], ["N2", "Nitrogen"], ["O2", "Oxygen"], ["F2", "Fluorine"], ["Cl2", "Chlorine"],
  ["CH4", "Methane"], ["NH3", "Ammonia"], ["H2O", "Nước"], ["HF", "Hydrogen fluoride"], ["HCl", "Hydrogen chloride"],
  ["CO2", "Carbon dioxide"], ["CF4", "Carbon tetrafluoride"], ["CCl4", "Carbon tetrachloride"],
  ["NF3", "Nitrogen trifluoride"], ["NCl3", "Nitrogen trichloride"], ["OF2", "Oxygen difluoride"], ["Cl2O", "Dichlorine oxide"], ["ClF", "Chlorine monofluoride"],
  ["NaF", "Sodium fluoride"], ["NaCl", "Sodium chloride"], ["Na2O", "Sodium oxide"],
  ["MgF2", "Magnesium fluoride"], ["MgCl2", "Magnesium chloride"], ["MgO", "Magnesium oxide"],
  ["KF", "Potassium fluoride"], ["KCl", "Potassium chloride"], ["K2O", "Potassium oxide"],
  ["CaF2", "Calcium fluoride"], ["CaCl2", "Calcium chloride"], ["CaO", "Calcium oxide"],
].map(([id, name]) => ({ id, name }));

// HF: Δχ = 1,78 reaches the ionic threshold, yet H–F is a polar covalent bond (the thresholds are only a guide).
export const EXCEPTIONS = { HF: "polar" };

/**
 * Why a pair is not drawn, or null when it is supported.
 * "metallic": two metals; "hydride": metal + H; "other": a pair without a simple compound that obeys the octet rule here.
 */
export function unsupported(a, b) {
  const A = ELEMENTS[a];
  const B = ELEMENTS[b];
  if (!A || !B) return "unknown";
  if (A.metal && B.metal) return "metallic";
  if (A.metal || B.metal) {
    const other = A.metal ? b : a;
    if (other === "H") return "hydride";
    return ["F", "Cl", "O"].includes(other) ? null : "other";
  }
  if (a === b) return ["H", "N", "O", "F", "Cl"].includes(a) ? null : "other";
  const pair = [a, b].sort().join("-");
  return ["C-N", "N-O"].includes(pair) ? "other" : null;
}

const gcd = (x, y) => (y ? gcd(y, x % y) : x);

/**
 * Formula from valences (hóa trị) by the cross rule: AxBy with x·a = y·b.
 * Order: metal first; otherwise the less electronegative element first, except that C and N are
 * written before H (CH4, NH3). Returns { id, parts: [[symbol, count], …] } or null for an unsupported pair.
 */
export function formulaOf(a, b) {
  if (unsupported(a, b)) return null;
  if (a === b) return { id: `${a}2`, parts: [[a, 2]] };
  let [p, q] = [a, b];
  const A = ELEMENTS[a];
  const B = ELEMENTS[b];
  const firstIsA = A.metal || (!B.metal && (b === "H" ? ["C", "N"].includes(a) : a === "H" ? !["C", "N"].includes(b) : A.chi < B.chi));
  if (!firstIsA) [p, q] = [b, a];
  const vp = ELEMENTS[p].valence;
  const vq = ELEMENTS[q].valence;
  const g = gcd(vp, vq);
  const parts = [[p, vq / g], [q, vp / g]];
  return { id: parts.map(([s, n]) => (n > 1 ? s + n : s)).join(""), parts };
}

/**
 * The bond for a pair: { a, b, deltaChi, rule, type, exception, formula, compound, reason }.
 * `rule` is the type by Δχ; `type` is the bond the sim draws (differs only for HF).
 */
export function bondFor(a, b) {
  const d = ELEMENTS[a] && ELEMENTS[b] ? deltaChi(a, b) : NaN;
  const rule = Number.isFinite(d) ? classify(d) : null;
  const reason = unsupported(a, b);
  if (reason) return { a, b, deltaChi: d, rule, type: null, exception: false, formula: null, compound: null, reason };
  const formula = formulaOf(a, b);
  const compound = COMPOUNDS.find(c => c.id === formula.id);
  const type = EXCEPTIONS[formula.id] ?? rule;
  return { a, b, deltaChi: d, rule, type, exception: type !== rule, formula, compound, reason: null };
}

/**
 * Lewis structure of a supported compound.
 * Covalent: { kind: "covalent", atoms: [{ el, lone, around }], bonds: [{ i, j, order }] }; atom 0 is central
 *   when there are more than two atoms. shared = bonding pairs the atom takes part in, lone = its lone pairs,
 *   around = electrons in its outer shell for the octet count (2 per shared pair + 2 per lone pair).
 * Ionic: { kind: "ionic", ions: [{ el, charge, given, around }] } where `given` is how many electrons moved
 *   (lost for a cation, gained for an anion) and `around` is the outer shell after the transfer.
 */
export function structure(bond) {
  const [[p, x], [q, y] = [null, 0]] = bond.formula.parts;
  if (bond.type === "ionic") {
    const ions = [];
    const metal = ELEMENTS[p];
    const anion = ELEMENTS[q];
    for (let k = 0; k < x; k++) ions.push({ el: p, charge: metal.valence, given: metal.valenceE, around: metal.shells.at(-2) });
    for (let k = 0; k < y; k++) ions.push({ el: q, charge: -anion.valence, given: anion.valence, around: anion.valenceE + anion.valence });
    // anions in the middle for AB2, cations in the middle for A2B, so charges alternate
    if (y === 2 && x === 1) ions.splice(1, 0, ions.splice(0, 1)[0]);
    if (x === 2 && y === 1) ions.splice(1, 0, ions.splice(2, 1)[0]);
    return { kind: "ionic", ions };
  }
  let atoms;
  let bonds;
  if (!q) {
    // homonuclear diatomic: bond order = valence
    atoms = [p, p];
    bonds = [{ i: 0, j: 1, order: ELEMENTS[p].valence }];
  } else if (x === 1 && y === 1) {
    atoms = [p, q];
    bonds = [{ i: 0, j: 1, order: Math.min(ELEMENTS[p].valence, ELEMENTS[q].valence) }];
  } else {
    // one central atom (subscript 1), the others terminal; each terminal uses all its valence on its one bond
    const [centre, term, n] = x === 1 ? [p, q, y] : [q, p, x];
    atoms = [centre, ...Array(n).fill(term)];
    bonds = atoms.slice(1).map((_, k) => ({ i: 0, j: k + 1, order: ELEMENTS[term].valence }));
  }
  return {
    kind: "covalent",
    bonds,
    atoms: atoms.map((el, i) => {
      const shared = bonds.reduce((sum, b) => sum + (b.i === i || b.j === i ? b.order : 0), 0);
      const lone = (ELEMENTS[el].valenceE - shared) / 2;
      // electrons around the atom: its lone pairs plus every shared pair it takes part in
      return { el, shared, lone, around: 2 * lone + 2 * shared };
    }),
  };
}

/** Octet (duet for H) check: [{ el, around, target, ok }] for every atom or ion. */
export function octet(st) {
  const list = st.kind === "ionic" ? st.ions : st.atoms;
  return list.map(({ el, around }) => {
    const target = el === "H" ? 2 : 8;
    return { el, around, target, ok: around === target };
  });
}

export const initialState = () => ({ a: "Na", b: "Cl", showShells: true });

/** Electron configuration as shells, e.g. "2, 8, 1". */
export const shellText = el => ELEMENTS[el].shells.join(", ");
