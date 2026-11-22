// Ion-exchange reactions between two electrolyte solutions.
// A reaction happens only when two ions leave the solution together as a precipitate, a gas
// or a weak electrolyte. Formulas are kept in plain ASCII ("Cu(OH)2") and prettified for display.

export const IONS = {
  Na: { f: "Na", q: 1 },
  K: { f: "K", q: 1 },
  Ag: { f: "Ag", q: 1 },
  Ba: { f: "Ba", q: 2 },
  Cu: { f: "Cu", q: 2 },
  H: { f: "H", q: 1 },
  NH4: { f: "NH4", q: 1 },
  Cl: { f: "Cl", q: -1 },
  NO3: { f: "NO3", q: -1 },
  SO4: { f: "SO4", q: -2 },
  CO3: { f: "CO3", q: -2 },
  OH: { f: "OH", q: -1 },
  CH3COO: { f: "CH3COO", q: -1 },
};
export const CATIONS = Object.keys(IONS).filter(k => IONS[k].q > 0);
export const ANIONS = Object.keys(IONS).filter(k => IONS[k].q < 0);

// Every solution here is a soluble strong electrolyte. The position in this list is its code in events.
export const SOLUTIONS = {
  NaCl: { c: "Na", a: "Cl", name: "sodium chloride" },
  AgNO3: { c: "Ag", a: "NO3", name: "silver nitrate" },
  BaCl2: { c: "Ba", a: "Cl", name: "barium chloride" },
  Na2SO4: { c: "Na", a: "SO4", name: "sodium sulfate" },
  Na2CO3: { c: "Na", a: "CO3", name: "sodium carbonate" },
  HCl: { c: "H", a: "Cl", name: "hydrochloric acid" },
  NaOH: { c: "Na", a: "OH", name: "sodium hydroxide" },
  CuSO4: { c: "Cu", a: "SO4", name: "copper(II) sulfate" },
  CH3COONa: { c: "Na", a: "CH3COO", name: "sodium acetate" },
  NH4Cl: { c: "NH4", a: "Cl", name: "ammonium chloride" },
  KNO3: { c: "K", a: "NO3", name: "potassium nitrate" },
};
export const SOLUTION_KEYS = Object.keys(SOLUTIONS);

export const TYPE = { none: 0, precipitate: 1, gas: 2, weak: 3 };

// The rules: which cation + anion leave the solution, written as the net ionic equation
// nc·cation + na·anion → products. Every other cation–anion pair of IONS stays dissolved.
// Conventions: Ag2SO4 and CH3COOAg (slightly soluble) are taken as soluble in dilute solution;
// AgOH does not exist and gives Ag2O; Cu2+ with CO3 2- is written as CuCO3 (in fact a basic carbonate).
export const RULES = [
  { c: "Ag", a: "Cl", nc: 1, na: 1, type: TYPE.precipitate, products: [{ n: 1, f: "AgCl", mark: "↓" }], colour: "#ffffff", colourName: "trắng", why: "AgCl không tan trong nước" },
  { c: "Ag", a: "CO3", nc: 2, na: 1, type: TYPE.precipitate, products: [{ n: 1, f: "Ag2CO3", mark: "↓" }], colour: "#f1e9b8", colourName: "vàng nhạt", why: "Ag₂CO₃ không tan trong nước" },
  { c: "Ag", a: "OH", nc: 2, na: 2, type: TYPE.precipitate, products: [{ n: 1, f: "Ag2O", mark: "↓" }, { n: 1, f: "H2O", mark: "" }], colour: "#3b2a22", colourName: "nâu đen", why: "AgOH không bền, phân hủy thành Ag₂O không tan" },
  { c: "Ba", a: "SO4", nc: 1, na: 1, type: TYPE.precipitate, products: [{ n: 1, f: "BaSO4", mark: "↓" }], colour: "#ffffff", colourName: "trắng", why: "BaSO₄ không tan trong nước" },
  { c: "Ba", a: "CO3", nc: 1, na: 1, type: TYPE.precipitate, products: [{ n: 1, f: "BaCO3", mark: "↓" }], colour: "#ffffff", colourName: "trắng", why: "BaCO₃ không tan trong nước" },
  { c: "Cu", a: "OH", nc: 1, na: 2, type: TYPE.precipitate, products: [{ n: 1, f: "Cu(OH)2", mark: "↓" }], colour: "#3f8fe0", colourName: "xanh lam", why: "Cu(OH)₂ không tan trong nước" },
  { c: "Cu", a: "CO3", nc: 1, na: 1, type: TYPE.precipitate, products: [{ n: 1, f: "CuCO3", mark: "↓" }], colour: "#6fc3b0", colourName: "xanh", why: "CuCO₃ không tan trong nước (viết đơn giản hóa)" },
  { c: "H", a: "OH", nc: 1, na: 1, type: TYPE.weak, products: [{ n: 1, f: "H2O", mark: "" }], why: "H₂O là chất điện li rất yếu" },
  { c: "H", a: "CH3COO", nc: 1, na: 1, type: TYPE.weak, products: [{ n: 1, f: "CH3COOH", mark: "" }], why: "CH₃COOH là acid yếu (chất điện li yếu)" },
  { c: "H", a: "CO3", nc: 2, na: 1, type: TYPE.gas, products: [{ n: 1, f: "CO2", mark: "↑" }, { n: 1, f: "H2O", mark: "" }], why: "H₂CO₃ kém bền, phân hủy thành khí CO₂ và H₂O" },
  { c: "NH4", a: "OH", nc: 1, na: 1, type: TYPE.gas, products: [{ n: 1, f: "NH3", mark: "↑" }, { n: 1, f: "H2O", mark: "" }], why: "tạo khí NH₃ mùi khai (rõ hơn khi đun nhẹ)" },
];
export const ruleFor = (c, a) => RULES.find(r => r.c === c && r.a === a) ?? null;

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const group = (f, n) => (n === 1 ? f : /^[A-Z][a-z]?$/.test(f) ? f + n : `(${f})${n}`);

/** Formula unit of the neutral compound of a cation and an anion: { f, nc, na }. */
export function compound(c, a) {
  const qc = IONS[c].q;
  const qa = -IONS[a].q;
  const g = gcd(qc, qa);
  const nc = qa / g;
  const na = qc / g;
  // acetates are written anion first: CH3COONa, (CH3COO)2Ba, CH3COOH
  const f = a === "CH3COO" ? group(IONS[a].f, na) + group(IONS[c].f, nc) : group(IONS[c].f, nc) + group(IONS[a].f, na);
  return { f, nc, na };
}

/** Atom counts of an ASCII formula, e.g. atoms("Cu(OH)2") = { Cu: 1, O: 2, H: 2 }. */
export function atoms(formula) {
  const stack = [{}];
  for (const m of formula.matchAll(/([A-Z][a-z]?)(\d*)|(\()|\)(\d*)/g)) {
    if (m[1]) stack.at(-1)[m[1]] = (stack.at(-1)[m[1]] ?? 0) + Number(m[2] || 1);
    else if (m[3]) stack.push({});
    else {
      const inner = stack.pop();
      for (const [el, n] of Object.entries(inner)) stack.at(-1)[el] = (stack.at(-1)[el] ?? 0) + n * Number(m[4] || 1);
    }
  }
  return stack[0];
}

const SUB = "₀₁₂₃₄₅₆₇₈₉";
const prettyFormula = f => f.replace(/\d/g, d => SUB[d]);
const CHARGE = { 1: "⁺", 2: "²⁺", "-1": "⁻", "-2": "²⁻" };
/** "SO4" → "SO₄²⁻" */
export const prettyIon = key => prettyFormula(IONS[key].f) + CHARGE[IONS[key].q];
/** A term is { n, f, mark } for a substance or { n, ion } for an ion. */
export const prettyTerm = t => (t.n > 1 ? t.n : "") + (t.ion ? prettyIon(t.ion) : prettyFormula(t.f) + (t.mark ?? ""));
export const prettyEquation = eq => `${eq.left.map(prettyTerm).join(" + ")} → ${eq.right.map(prettyTerm).join(" + ")}`;

/** Atoms and total charge on one side of an equation, for checking balance. */
export function tally(side) {
  const out = { charge: 0 };
  for (const t of side) {
    for (const [el, n] of Object.entries(atoms(t.ion ? IONS[t.ion].f : t.f))) out[el] = (out[el] ?? 0) + n * t.n;
    if (t.ion) out.charge += IONS[t.ion].q * t.n;
  }
  return out;
}

const solutionOf = key => (SOLUTIONS[key] ? key : SOLUTION_KEYS[0]);

/**
 * Mix solution a with solution b.
 * Returns { a, b, reacted, type, reactions, molecular, ionic, net, spectators }; the three equations
 * are null and spectators is empty when nothing reacts. `type` is the TYPE code of the (first) product.
 */
export function mix(aKey, bKey) {
  const a = solutionOf(aKey);
  const b = solutionOf(bKey);
  const A = SOLUTIONS[a];
  const B = SOLUTIONS[b];
  const ua = compound(A.c, A.a);
  const ub = compound(B.c, B.a);
  // cross pairs: cation of one with anion of the other
  const pairs = [
    { c: A.c, a: B.a, cPer: ua.nc, aPer: ub.na, cFrom: 0, aFrom: 1 },
    { c: B.c, a: A.a, cPer: ub.nc, aPer: ua.na, cFrom: 1, aFrom: 0 },
  ].map(p => ({ ...p, rule: a === b ? null : ruleFor(p.c, p.a) }));
  const reactions = pairs.filter(p => p.rule).map(p => p.rule);
  const base = { a, b, reacted: reactions.length > 0, type: reactions[0]?.type ?? TYPE.none, reactions };
  if (!base.reacted) return { ...base, molecular: null, ionic: null, net: [], spectators: [] };

  // smallest whole coefficients x·A + y·B for which every cross pair is used up exactly
  for (let sum = 2; sum <= 12; sum++) {
    for (let x = 1; x < sum; x++) {
      const coef = [x, sum - x];
      const right = [];
      const ionicRight = [];
      const ok = pairs.every(p => {
        const nc = coef[p.cFrom] * p.cPer;
        const na = coef[p.aFrom] * p.aPer;
        if (p.rule) {
          const m = nc / p.rule.nc;
          if (!Number.isInteger(m) || m * p.rule.na !== na) return false;
          const made = p.rule.products.map(t => ({ ...t, n: t.n * m }));
          right.unshift(...made); // what leaves the solution is written first
          ionicRight.unshift(...made);
        } else {
          const salt = compound(p.c, p.a);
          const m = nc / salt.nc;
          if (!Number.isInteger(m) || m * salt.na !== na) return false;
          right.push({ n: m, f: salt.f, mark: "" });
          ionicRight.push({ n: nc, ion: p.c }, { n: na, ion: p.a });
        }
        return true;
      });
      if (!ok) continue;
      const ion = (n, key) => ({ n, ion: key });
      return {
        ...base,
        molecular: { left: [{ n: coef[0], f: ua.f, mark: "" }, { n: coef[1], f: ub.f, mark: "" }], right },
        ionic: {
          left: [ion(coef[0] * ua.nc, A.c), ion(coef[0] * ua.na, A.a), ion(coef[1] * ub.nc, B.c), ion(coef[1] * ub.na, B.a)],
          right: ionicRight,
        },
        net: reactions.map(r => ({ left: [ion(r.nc, r.c), ion(r.na, r.a)], right: r.products })),
        spectators: pairs.filter(p => !p.rule).flatMap(p => [p.c, p.a]),
      };
    }
  }
  throw new Error(`cannot balance ${a} + ${b}`);
}

/** Ions of one solution per formula unit, e.g. BaCl2 → ["Ba", "Cl", "Cl"]. */
export function ionsOf(key) {
  const S = SOLUTIONS[solutionOf(key)];
  const u = compound(S.c, S.a);
  return [...Array(u.nc).fill(S.c), ...Array(u.na).fill(S.a)];
}

/** Is the learner's choice of reacting ions right? "none" + "none" is right when nothing reacts. */
export function pickIsRight(aKey, bKey, cation, anion) {
  const r = mix(aKey, bKey);
  if (!r.reacted) return cation === "none" && anion === "none";
  return r.reactions.some(rule => rule.c === cation && rule.a === anion);
}

export const initialState = () => ({
  a: "BaCl2",
  b: "Na2SO4",
  pickCation: "Ba",
  pickAnion: "SO4",
  revealed: true, // equations are shown; choosing another solution hides them until the learner answers
});
