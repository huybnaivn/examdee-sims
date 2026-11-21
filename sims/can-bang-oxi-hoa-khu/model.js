// Phản ứng oxi hóa – khử, cân bằng bằng phương pháp thăng bằng electron (Hóa học 10, CT 2018).
// Pure logic: formula parsing, oxidation numbers by the textbook rules, half-processes, coefficients.

// Species are written "Cu(NO3)2", ions with a caret: "Fe^2+", "MnO4^-", "H^+".
// `coeffs` is the balanced equation with the smallest whole numbers (checked in the tests).
export const REACTIONS = [
  { id: "fe-o2", name: "Sắt cháy trong oxi tạo Fe₂O₃", left: ["Fe", "O2"], right: ["Fe2O3"], coeffs: [4, 3, 2] },
  { id: "zn-hcl", name: "Kẽm tác dụng với dung dịch HCl", left: ["Zn", "HCl"], right: ["ZnCl2", "H2"], coeffs: [1, 2, 1, 1] },
  { id: "fe2o3-co", name: "Khử Fe₂O₃ bằng CO", left: ["Fe2O3", "CO"], right: ["Fe", "CO2"], coeffs: [1, 3, 2, 3] },
  { id: "cu-hno3-loang", name: "Cu + HNO₃ loãng", left: ["Cu", "HNO3"], right: ["Cu(NO3)2", "NO", "H2O"], coeffs: [3, 8, 3, 2, 4] },
  { id: "cu-hno3-dac", name: "Cu + HNO₃ đặc", left: ["Cu", "HNO3"], right: ["Cu(NO3)2", "NO2", "H2O"], coeffs: [1, 4, 1, 2, 2] },
  { id: "fe-hno3-loang", name: "Fe + HNO₃ loãng", left: ["Fe", "HNO3"], right: ["Fe(NO3)3", "NO", "H2O"], coeffs: [1, 4, 1, 1, 2] },
  { id: "al-h2so4-dac", name: "Al + H₂SO₄ đặc, nóng", left: ["Al", "H2SO4"], right: ["Al2(SO4)3", "SO2", "H2O"], coeffs: [2, 6, 1, 3, 6] },
  { id: "c-h2so4-dac", name: "C + H₂SO₄ đặc, nóng", left: ["C", "H2SO4"], right: ["CO2", "SO2", "H2O"], coeffs: [1, 2, 1, 2, 2] },
  { id: "mno2-hcl", name: "MnO₂ + HCl đặc", left: ["MnO2", "HCl"], right: ["MnCl2", "Cl2", "H2O"], coeffs: [1, 4, 1, 1, 2] },
  { id: "kmno4-hcl", name: "KMnO₄ + HCl đặc", left: ["KMnO4", "HCl"], right: ["KCl", "MnCl2", "Cl2", "H2O"], coeffs: [2, 16, 2, 2, 5, 8] },
  { id: "nh3-o2", name: "Oxi hóa NH₃ (xúc tác Pt)", left: ["NH3", "O2"], right: ["NO", "H2O"], coeffs: [4, 5, 4, 6] },
  { id: "fe-cuso4", name: "Fe + dung dịch CuSO₄", left: ["Fe", "CuSO4"], right: ["FeSO4", "Cu"], coeffs: [1, 1, 1, 1] },
  { id: "fe2-mno4", name: "Fe²⁺ + MnO₄⁻ trong môi trường acid", left: ["Fe^2+", "MnO4^-", "H^+"], right: ["Fe^3+", "Mn^2+", "H2O"], coeffs: [5, 1, 8, 5, 1, 4] },
];
export const MAX_SPECIES = 6;
export const MAX_COEF = 20;
export const LAST_STEP = 6;
export const STEPS = [
  "Sơ đồ phản ứng",
  "Bước 1. Xác định số oxi hóa của các nguyên tử",
  "Bước 1. Xác định chất khử và chất oxi hóa",
  "Bước 2. Viết quá trình oxi hóa và quá trình khử",
  "Bước 3. Tìm hệ số: tổng số electron nhường = tổng số electron nhận",
  "Bước 4. Đặt hệ số vào chất khử, chất oxi hóa và sản phẩm của chúng",
  "Bước 4. Cân bằng các nguyên tố còn lại và kiểm tra",
];

export const reactionIndex = id => Math.max(0, REACTIONS.findIndex(r => r.id === id));
export const reactionById = id => REACTIONS[reactionIndex(id)];

// ---------- formulas ----------
export function parseFormula(formula) {
  const stack = [{}];
  const add = (el, n) => {
    const top = stack[stack.length - 1];
    top[el] = (top[el] ?? 0) + n;
  };
  const token = /([A-Z][a-z]?)(\d*)|(\()|\)(\d*)/y;
  let m;
  let end = 0;
  while ((m = token.exec(formula))) {
    end = token.lastIndex;
    if (m[1]) add(m[1], Number(m[2] || 1));
    else if (m[3]) stack.push({});
    else {
      if (stack.length < 2) throw new Error(`Bad formula: ${formula}`);
      const group = stack.pop();
      for (const [el, n] of Object.entries(group)) add(el, n * Number(m[4] || 1));
    }
  }
  if (!formula || end !== formula.length || stack.length !== 1) throw new Error(`Bad formula: ${formula}`);
  return stack[0];
}

/** "MnO4^-" → { f: "MnO4", z: -1 } */
export function parseSpecies(text) {
  const [f, charge = ""] = text.split("^");
  const m = charge.match(/^(\d*)([+-])$/);
  return { f, z: m ? (m[2] === "+" ? 1 : -1) * Number(m[1] || 1) : 0 };
}

const SUB = "₀₁₂₃₄₅₆₇₈₉";
const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
export const subscript = s => String(s).replace(/\d/g, d => SUB[d]);
/** Charge of an ion as written after the formula: 2+ → "²⁺", − → "⁻". */
export const chargeText = z => (z === 0 ? "" : (Math.abs(z) > 1 ? String(Math.abs(z)).replace(/\d/g, d => SUP[d]) : "") + (z > 0 ? "⁺" : "⁻"));
/** Oxidation number as written above a symbol: sign first ("+5", "−2", "0"). */
export const onText = n => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");
/** Oxidation number as a superscript in a half-process: Fe⁺³, O⁻², Cu⁰. */
export const onSup = n => (n > 0 ? "⁺" : n < 0 ? "⁻" : "") + String(Math.abs(n)).replace(/\d/g, d => SUP[d]);
export const pretty = text => {
  const { f, z } = parseSpecies(text);
  return subscript(f) + chargeText(z);
};

/** Display pieces of a species: element symbols carry `el` so an oxidation number can be put above them. */
export function pieces(text) {
  const { f, z } = parseSpecies(text);
  const out = [];
  for (const m of f.matchAll(/([A-Z][a-z]?)|(\d+)|([()])/g)) {
    if (m[1]) out.push({ text: m[1], el: m[1] });
    else out.push({ text: m[2] ? subscript(m[2]) : m[3] });
  }
  if (z) out.push({ text: chargeText(z) });
  return out;
}

// ---------- oxidation numbers ----------
// Textbook rules, in this order:
//  1. đơn chất: 0; ion đơn nguyên tử: bằng điện tích ion;
//  2. trong hợp chất: kim loại kiềm (Li, Na, K) +1, kim loại kiềm thổ (Mg, Ca, Ba) và Zn +2, Al +3, F −1,
//     H +1, O −2 (không xét hiđrua kim loại, peroxide, OF₂ – không có trong bộ phản ứng này);
//     halogen Cl, Br, I là −1 và S là −2 khi đứng cuối trong hợp chất không có O (muối halide, sulfide);
//  3. tổng số oxi hóa trong phân tử bằng 0, trong ion bằng điện tích ion; còn hai ẩn thì tách gốc acid đã biết.
const FIXED = { Li: 1, Na: 1, K: 1, Mg: 2, Ca: 2, Ba: 2, Zn: 2, Al: 3, F: -1, H: 1, O: -2 };
const HALOGENS = ["Cl", "Br", "I"];
const ANIONS = { SO4: -2, NO3: -1, CO3: -2, PO4: -3, OH: -1 };

/** { element: oxidation number } for a formula with total charge z. All atoms of an element are assumed equal. */
export function oxidationNumbers(f, z = 0) {
  const counts = parseFormula(f);
  const els = Object.keys(counts);
  if (els.length === 1) return { [els[0]]: z / counts[els[0]] };
  const on = {};
  const hasO = "O" in counts;
  for (const el of els) {
    if (el in FIXED) on[el] = FIXED[el];
    else if (!hasO && HALOGENS.includes(el) && el === els.at(-1)) on[el] = -1;
    else if (!hasO && el === "S" && el === els.at(-1)) on[el] = -2;
  }
  let unknown = els.filter(el => !(el in on));
  if (unknown.length > 1) {
    const m = f.match(/\(([A-Za-z0-9]+)\)\d*$/) ?? f.match(/(SO4|NO3|CO3|PO4)$/);
    if (m && m[1] in ANIONS) {
      const inner = oxidationNumbers(m[1], ANIONS[m[1]]);
      for (const el of Object.keys(inner)) if (!(el in on)) on[el] = inner[el];
      unknown = els.filter(el => !(el in on));
    }
  }
  if (unknown.length > 1) throw new Error(`Cannot assign oxidation numbers in ${f}`);
  if (unknown.length === 1) {
    const u = unknown[0];
    const rest = els.reduce((sum, el) => (el === u ? sum : sum + on[el] * counts[el]), 0);
    on[u] = (z - rest) / counts[u];
  }
  return on;
}

// ---------- balancing ----------
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
export const lcm = (a, b) => (a * b) / gcd(a, b);
export const gcdAll = list => list.reduce(gcd);

const cache = new Map();
/**
 * Everything the steps show: species with oxidation numbers, the two half-processes
 * (ordered by where their reactant stands in the equation) and the electron-derived coefficients.
 */
export function analyze(r) {
  if (cache.has(r.id)) return cache.get(r.id);
  const all = [...r.left, ...r.right].map((text, i) => {
    const { f, z } = parseSpecies(text);
    const counts = parseFormula(f);
    return { text, f, z, counts, left: i < r.left.length, on: oxidationNumbers(f, z), simple: Object.keys(counts).length === 1 && z === 0 };
  });
  const els = [...new Set(all.flatMap(s => Object.keys(s.counts)))];
  const halves = [];
  for (const el of els) {
    const states = left => new Set(all.filter(s => s.left === left && el in s.counts).map(s => s.on[el]));
    const L = states(true);
    const R = states(false);
    const a = L.size === 1 ? [...L][0] : [...L].find(v => !R.has(v));
    const b = R.size === 1 ? [...R][0] : [...R].find(v => !L.has(v));
    if (a === undefined || b === undefined || a === b) continue;
    const from = all.findIndex(s => s.left && el in s.counts && s.on[el] === a);
    const to = all.findIndex(s => !s.left && el in s.counts && s.on[el] === b);
    // atoms per half-process: a diatomic simple substance (O₂, Cl₂, H₂) is written as a whole
    const k = all[from].simple ? all[from].counts[el] : all[to].simple ? all[to].counts[el] : 1;
    halves.push({ el, a, b, k, from, to, e: k * Math.abs(b - a), ox: b > a });
  }
  halves.sort((p, q) => p.from - q.from);
  const total = halves.length === 2 ? lcm(halves[0].e, halves[1].e) : 0;
  for (const h of halves) h.mult = total / h.e;

  // Coefficient from the electron balance, only where a species holds that state alone and the state
  // does not also survive unchanged on the other side (e.g. HNO₃ is also the source of NO₃⁻ in the salt).
  const partial = all.map(() => null);
  for (const h of halves) {
    for (const [left, state] of [[true, h.a], [false, h.b]]) {
      const holders = all.map((s, i) => i).filter(i => all[i].left === left && h.el in all[i].counts && all[i].on[h.el] === state);
      const other = all.some(s => s.left !== left && h.el in s.counts && s.on[h.el] === state);
      if (holders.length !== 1 || other) continue;
      partial[holders[0]] = (h.mult * h.k) / all[holders[0]].counts[h.el];
    }
  }
  const result = {
    species: all,
    halves,
    electrons: total,
    reducer: halves.find(h => h.ox)?.from ?? -1,
    oxidiser: halves.find(h => !h.ox)?.from ?? -1,
    partial,
  };
  cache.set(r.id, result);
  return result;
}

/** Atom count per element and total charge on each side for the given coefficients. */
export function tally(r, coeffs) {
  const { species } = analyze(r);
  const side = left => {
    const atoms = {};
    let charge = 0;
    species.forEach((s, i) => {
      if (s.left !== left) return;
      for (const [el, n] of Object.entries(s.counts)) atoms[el] = (atoms[el] ?? 0) + n * coeffs[i];
      charge += s.z * coeffs[i];
    });
    return { atoms, charge };
  };
  return { left: side(true), right: side(false) };
}

/** "balanced" (smallest whole numbers), "multiple" (balanced, reducible) or "unbalanced". */
export function status(r, coeffs) {
  const n = r.left.length + r.right.length;
  if (coeffs.length !== n || !coeffs.every(c => Number.isInteger(c) && c > 0)) return "unbalanced";
  const { left, right } = tally(r, coeffs);
  const ok = Object.keys(left.atoms).every(el => left.atoms[el] === right.atoms[el]) && left.charge === right.charge;
  if (!ok) return "unbalanced";
  return gcdAll(coeffs) === 1 ? "balanced" : "multiple";
}

// ---------- state ----------
export const PRACTICE_KEYS = ["p1", "p2", "p3", "p4", "pe1", "pe2", "pm1", "pm2", "c1", "c2", "c3", "c4", "c5", "c6"];

export function clearPractice(s) {
  for (const key of PRACTICE_KEYS) s[key] = key.startsWith("c") || key.startsWith("pm") || key.startsWith("pe") ? 1 : 0;
  s.pRed = -1;
  s.pOx = -1;
  s.step = 0;
  s.solved = false;
  s.mistakes = 0;
  s._msg = "";
  return s;
}

export const initialState = () => ({ reaction: "cu-hno3-loang", mode: "demo", ...clearPractice({}), step: 1 });

export const learnerCoeffs = s => ["c1", "c2", "c3", "c4", "c5", "c6"].slice(0, reactionById(s.reaction).coeffs.length).map(k => s[k]);

/**
 * Check the learner's answer for the current practice step.
 * Returns { ok, msg }. Steps 0 and 5 need no input.
 */
export function checkStep(s) {
  const r = reactionById(s.reaction);
  const A = analyze(r);
  const [h1, h2] = A.halves;
  const name = i => pretty(A.species[i].text);
  if (s.step === 1) {
    const want = [h1.a, h1.b, h2.a, h2.b];
    const got = [s.p1, s.p2, s.p3, s.p4];
    const bad = want.findIndex((v, i) => v !== got[i]);
    if (bad < 0) return { ok: true, msg: "Đúng: số oxi hóa đã xác định." };
    const h = bad < 2 ? h1 : h2;
    const where = name(bad % 2 ? h.to : h.from);
    return { ok: false, msg: `Xem lại số oxi hóa của ${h.el} trong ${where}: tổng số oxi hóa trong ${A.species[bad % 2 ? h.to : h.from].z ? "ion bằng điện tích ion" : "phân tử bằng 0"}.` };
  }
  if (s.step === 2) {
    if (s.pRed === A.reducer && s.pOx === A.oxidiser) return { ok: true, msg: "Đúng: chất khử nhường electron, chất oxi hóa nhận electron." };
    if (s.pRed < 0 || s.pOx < 0) return { ok: false, msg: "Hãy chọn cả chất khử và chất oxi hóa." };
    return { ok: false, msg: "Chất khử chứa nguyên tố có số oxi hóa tăng; chất oxi hóa chứa nguyên tố có số oxi hóa giảm." };
  }
  if (s.step === 3) {
    if (s.pe1 === h1.e && s.pe2 === h2.e) return { ok: true, msg: "Đúng: số electron của mỗi quá trình." };
    const h = s.pe1 !== h1.e ? h1 : h2;
    return { ok: false, msg: `Số electron = (số oxi hóa lớn − số oxi hóa nhỏ) × số nguyên tử ${h.el} trong quá trình${h.k > 1 ? ` (ở đây là ${h.k})` : ""}.` };
  }
  if (s.step === 4) {
    if (s.pm1 === h1.mult && s.pm2 === h2.mult) return { ok: true, msg: `Đúng: BCNN(${h1.e}; ${h2.e}) = ${A.electrons}.` };
    if (s.pm1 * h1.e === s.pm2 * h2.e) return { ok: false, msg: "Số electron đã bằng nhau nhưng chưa nhỏ nhất: dùng bội chung nhỏ nhất." };
    return { ok: false, msg: "Nhân mỗi quá trình với một số sao cho tổng electron nhường bằng tổng electron nhận." };
  }
  if (s.step === LAST_STEP) {
    const st = status(r, learnerCoeffs(s));
    if (st === "balanced") return { ok: true, msg: "Phương trình đã cân bằng." };
    if (st === "multiple") return { ok: false, msg: `Đã cân bằng nhưng chưa tối giản: chia các hệ số cho ${gcdAll(learnerCoeffs(s))}.` };
    return { ok: false, msg: "Chưa cân bằng: so sánh số nguyên tử mỗi nguyên tố (và điện tích) ở hai vế." };
  }
  return { ok: true, msg: "" };
}

/** Clamp keys that have no kit control (forged state must not break the model). */
export function sanitize(incoming, base) {
  const out = {};
  if (REACTIONS.some(r => r.id === incoming.reaction)) out.reaction = incoming.reaction;
  if (incoming.mode === "demo" || incoming.mode === "practice") out.mode = incoming.mode;
  const int = (v, lo, hi) => (Number.isInteger(v) ? Math.min(hi, Math.max(lo, v)) : undefined);
  out.step = int(incoming.step, 0, LAST_STEP);
  for (const key of ["p1", "p2", "p3", "p4"]) out[key] = int(incoming[key], -4, 8);
  for (const key of ["pe1", "pe2", "pm1", "pm2"]) out[key] = int(incoming[key], 1, 12);
  for (const key of ["c1", "c2", "c3", "c4", "c5", "c6"]) out[key] = int(incoming[key], 1, MAX_COEF);
  out.pRed = int(incoming.pRed, -1, MAX_SPECIES - 1);
  out.pOx = int(incoming.pOx, -1, MAX_SPECIES - 1);
  out.mistakes = int(incoming.mistakes, 0, 999);
  if (typeof incoming.solved === "boolean") out.solved = incoming.solved;
  for (const key of Object.keys(out)) if (out[key] === undefined) out[key] = base[key];
  return out;
}
