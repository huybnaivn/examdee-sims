// Reactions of metals with dilute HCl, salt solutions and water, from the activity series
// K, Na, Mg, Al, Zn, Fe, Pb, (H), Cu, Ag, Au (Khoa học tự nhiên 9, chương trình 2018).
// Equations use ASCII digits for subscripts (rendered with sub() for display) and ↑ / ↓ for gas / precipitate.

export const METALS = [
  { symbol: "K", name: "potassium" },
  { symbol: "Na", name: "sodium" },
  { symbol: "Mg", name: "magnesium" },
  { symbol: "Al", name: "nhôm" },
  { symbol: "Zn", name: "kẽm" },
  { symbol: "Fe", name: "sắt" },
  { symbol: "Pb", name: "chì" },
  { symbol: "Cu", name: "đồng" },
  { symbol: "Ag", name: "bạc" },
  { symbol: "Au", name: "vàng" },
].map((m, i) => ({ ...m, rank: i }));

/** Activity series as displayed, with H placed between Pb and Cu. */
export const SERIES = ["K", "Na", "Mg", "Al", "Zn", "Fe", "Pb", "H", "Cu", "Ag", "Au"];
const rankOf = symbol => SERIES.indexOf(symbol);

// `ion` is the element whose cation the metal would have to displace (null for water).
export const SOLUTIONS = [
  { id: "hcl", label: "HCl loãng", formula: "HCl", ion: "H", color: "clear" },
  { id: "cuso4", label: "CuSO₄", formula: "CuSO4", ion: "Cu", color: "blue" },
  { id: "agno3", label: "AgNO₃", formula: "AgNO3", ion: "Ag", color: "clear" },
  { id: "feso4", label: "FeSO₄", formula: "FeSO4", ion: "Fe", color: "green" },
  { id: "h2o", label: "Nước (H₂O)", formula: "H2O", ion: null, color: "clear" },
];

const alkali = m => ({
  hcl: { eq: [`2${m} + 2HCl -> 2${m}Cl + H2↑`], to: "clear", note: `${m} phản ứng mãnh liệt với axit; nếu ${m} dư, phần dư tiếp tục phản ứng với nước.` },
  cuso4: { eq: [`2${m} + 2H2O -> 2${m}OH + H2↑`, `2${m}OH + CuSO4 -> Cu(OH)2↓ + ${m}2SO4`], to: "clear", ppt: "blue", note: `${m} phản ứng với nước trước, không đẩy được Cu ra khỏi muối.` },
  agno3: { eq: [`2${m} + 2H2O -> 2${m}OH + H2↑`, `2${m}OH + 2AgNO3 -> Ag2O↓ + 2${m}NO3 + H2O`], to: "clear", ppt: "brown", note: `${m} phản ứng với nước trước, không đẩy được Ag ra khỏi muối.` },
  feso4: { eq: [`2${m} + 2H2O -> 2${m}OH + H2↑`, `2${m}OH + FeSO4 -> Fe(OH)2↓ + ${m}2SO4`], to: "clear", ppt: "white", note: `${m} phản ứng với nước trước, không đẩy được Fe ra khỏi muối.` },
  h2o: { eq: [`2${m} + 2H2O -> 2${m}OH + H2↑`], to: "clear", note: `${m} tan trong nước ở nhiệt độ thường, tạo dung dịch base.` },
});

// Every allowed pair. A missing entry means no reaction.
const TABLE = {
  K: alkali("K"),
  Na: alkali("Na"),
  Mg: {
    hcl: { eq: ["Mg + 2HCl -> MgCl2 + H2↑"], to: "clear" },
    cuso4: { eq: ["Mg + CuSO4 -> MgSO4 + Cu"], to: "clear" },
    agno3: { eq: ["Mg + 2AgNO3 -> Mg(NO3)2 + 2Ag"], to: "clear" },
    feso4: { eq: ["Mg + FeSO4 -> MgSO4 + Fe"], to: "clear" },
  },
  Al: {
    hcl: { eq: ["2Al + 6HCl -> 2AlCl3 + 3H2↑"], to: "clear" },
    cuso4: { eq: ["2Al + 3CuSO4 -> Al2(SO4)3 + 3Cu"], to: "clear" },
    agno3: { eq: ["Al + 3AgNO3 -> Al(NO3)3 + 3Ag"], to: "clear" },
    feso4: { eq: ["2Al + 3FeSO4 -> Al2(SO4)3 + 3Fe"], to: "clear" },
  },
  Zn: {
    hcl: { eq: ["Zn + 2HCl -> ZnCl2 + H2↑"], to: "clear" },
    cuso4: { eq: ["Zn + CuSO4 -> ZnSO4 + Cu"], to: "clear" },
    agno3: { eq: ["Zn + 2AgNO3 -> Zn(NO3)2 + 2Ag"], to: "clear" },
    feso4: { eq: ["Zn + FeSO4 -> ZnSO4 + Fe"], to: "clear" },
  },
  Fe: {
    hcl: { eq: ["Fe + 2HCl -> FeCl2 + H2↑"], to: "green", note: "Sắt tạo muối sắt(II), dung dịch có màu lục nhạt." },
    cuso4: { eq: ["Fe + CuSO4 -> FeSO4 + Cu"], to: "green" },
    agno3: { eq: ["Fe + 2AgNO3 -> Fe(NO3)2 + 2Ag"], to: "green", note: "Nếu AgNO₃ dư, Fe(NO₃)₂ còn bị oxi hóa tiếp thành Fe(NO₃)₃ (không mô phỏng)." },
  },
  Pb: {
    hcl: { eq: ["Pb + 2HCl -> PbCl2 + H2↑"], to: "clear", slow: true, note: "Rất chậm: PbCl₂ ít tan bám lên bề mặt chì." },
    cuso4: { eq: ["Pb + CuSO4 -> PbSO4↓ + Cu"], to: "blue", slow: true, note: "Rất chậm: PbSO₄ không tan bám lên bề mặt chì." },
    agno3: { eq: ["Pb + 2AgNO3 -> Pb(NO3)2 + 2Ag"], to: "clear" },
  },
  Cu: {
    agno3: { eq: ["Cu + 2AgNO3 -> Cu(NO3)2 + 2Ag"], to: "blue" },
  },
};

const clampIndex = (i, list) => Math.min(list.length - 1, Math.max(0, Math.round(Number(i) || 0)));
export const metal = i => METALS[clampIndex(i, METALS)];
export const solution = i => SOLUTIONS[clampIndex(i, SOLUTIONS)];

/** The textbook rule, independent of the table: does this pair react? */
export function predicted(mi, si) {
  const m = metal(mi);
  const sol = solution(si);
  if (m.symbol === "K" || m.symbol === "Na") return true; // react with the water of any solution
  if (!sol.ion) return false; // other metals do not react with water at room temperature
  return rankOf(m.symbol) < rankOf(sol.ion);
}

/** The reaction for a pair, or null when nothing happens. */
export function reaction(mi, si) {
  const m = metal(mi);
  const sol = solution(si);
  const r = TABLE[m.symbol]?.[sol.id];
  if (!r) return null;
  const last = r.eq.at(-1);
  const deposit = ["Cu", "Ag", "Fe"].find(x => parse(last).products.some(p => p.formula === x)) ?? null;
  return { ...r, gas: r.eq.some(e => e.includes("↑")), deposit, dissolves: m.symbol === "K" || m.symbol === "Na", ppt: r.ppt ?? (r.eq.some(e => e.includes("PbSO4↓")) ? "white" : null) };
}

// ---------- equations ----------

const SUBS = "₀₁₂₃₄₅₆₇₈₉";
/** Display form: subscripts after a symbol or ")", coefficients stay as they are; -> becomes →. */
export const sub = eq => eq.replace(/->/g, "→").replace(/([A-Za-z)])(\d+)/g, (_, a, d) => a + [...d].map(c => SUBS[c]).join(""));

/** Atom counts of one formula such as Al2(SO4)3. */
export function atoms(formula) {
  const stack = [{}];
  for (const m of formula.replace(/[↑↓]/g, "").matchAll(/([A-Z][a-z]?)(\d*)|(\()|\)(\d*)/g)) {
    if (m[1]) {
      const top = stack.at(-1);
      top[m[1]] = (top[m[1]] ?? 0) + Number(m[2] || 1);
    } else if (m[3]) stack.push({});
    else {
      const inner = stack.pop();
      const top = stack.at(-1);
      for (const [el, n] of Object.entries(inner)) top[el] = (top[el] ?? 0) + n * Number(m[4] || 1);
    }
  }
  return stack[0];
}

const term = t => {
  const m = t.trim().match(/^(\d*)(.+)$/);
  return { coef: Number(m[1] || 1), formula: m[2].replace(/[↑↓]/g, "") };
};

export function parse(eq) {
  const [left, right] = eq.split("->");
  return { reactants: left.split(" + ").map(term), products: right.split(" + ").map(term) };
}

const side = terms => {
  const total = {};
  for (const { coef, formula } of terms) for (const [el, n] of Object.entries(atoms(formula))) total[el] = (total[el] ?? 0) + coef * n;
  return total;
};

/** True when every element has the same number of atoms on both sides. */
export function balanced(eq) {
  const { reactants, products } = parse(eq);
  const a = side(reactants);
  const b = side(products);
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every(k => a[k] === b[k]);
}

export const initialState = () => ({
  metal: 4, // Zn
  solution: 1, // CuSO₄
  practice: false, // practice mode: predict before dropping the metal
  prediction: "none", // "none" | "yes" | "no"
  dropped: true, // the metal is in the solution
  progress: 1, // 0…1 of the animation after dropping
  verdict: -1, // practice result for the last drop: 1 correct, 0 wrong, -1 not judged
});

/** Animation clock: about 3.5 s from the drop to the end. */
export function step(s, dt) {
  if (!s.dropped || s.progress >= 1) return false;
  s.progress = Math.min(1, s.progress + dt / 3.5);
  return s.progress >= 1;
}
