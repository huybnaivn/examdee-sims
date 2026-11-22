// Chemical properties of acids and bases (KHTN 8). A reagent solution is added to a test tube
// that already holds one target substance; the outcome depends only on the pair.
// Conditions: dilute solutions, room temperature.

export const REAGENTS = ["HCl", "H2SO4", "NaOH", "CaOH2"];
export const REAGENT_INFO = {
  HCl: { kind: "acid", formula: "HCl", name: "dung dịch HCl (hydrochloric acid)" },
  H2SO4: { kind: "acid", formula: "H2SO4", name: "dung dịch H₂SO₄ loãng (sulfuric acid)" },
  NaOH: { kind: "base", formula: "NaOH", name: "dung dịch NaOH (sodium hydroxide)" },
  CaOH2: { kind: "base", formula: "Ca(OH)2", name: "dung dịch Ca(OH)₂ (nước vôi trong)" },
};

// "neut" is the neutralisation partner: NaOH solution for an acid, HCl solution for a base,
// both with a drop of phenolphthalein so the end of the reaction can be seen.
export const TARGETS = ["quy", "Zn", "Fe", "Cu", "CuO", "neut", "CaCO3", "BaCl2", "CuSO4"];
export const TARGET_INFO = {
  quy: { short: "Quỳ tím", name: "Giấy quỳ tím (chất chỉ thị)", look: { paper: "purple" } },
  Zn: { short: "Zn", name: "Kim loại Zn (kẽm)", look: { solid: "Zn" } },
  Fe: { short: "Fe", name: "Kim loại Fe (sắt)", look: { solid: "Fe" } },
  Cu: { short: "Cu", name: "Kim loại Cu (đồng)", look: { solid: "Cu" } },
  CuO: { short: "CuO", name: "Oxide base CuO (bột màu đen)", look: { solid: "CuO" } },
  neut: { short: "Trung hòa", name: "Base hoặc acid (phản ứng trung hòa)", look: {} },
  CaCO3: { short: "CaCO₃", name: "Muối CaCO₃ (đá vôi)", look: { solid: "CaCO3" } },
  BaCl2: { short: "BaCl₂", name: "Dung dịch muối BaCl₂", look: { liquid: "clear" } },
  CuSO4: { short: "CuSO₄", name: "Dung dịch muối CuSO₄ (màu xanh lam)", look: { liquid: "blue" } },
};

/** Unicode subscripts and arrow for a formula or equation written with plain digits. */
export const pretty = f => f.replace(/(?<=[A-Za-z)])\d+/g, d => [...d].map(c => "₀₁₂₃₄₅₆₇₈₉"[c]).join("")).replace("->", "→");

const NONE = "Không có hiện tượng";
const NO_EXCHANGE = "Không tạo kết tủa, chất khí hay nước nên phản ứng không xảy ra";
const CU = "Cu đứng sau H trong dãy hoạt động hóa học, không đẩy được hydrogen khỏi acid loãng";
const BASE_METAL = "Tác dụng với kim loại không phải là tính chất chung của base";
const BASE_ZN = "Dung dịch loãng, nhiệt độ thường: không thấy hiện tượng (Zn chỉ tan trong kiềm đặc, nóng)";
const BASE_OXIDE = "Oxide base không tác dụng với base";
const LITMUS_RED = { r: 1, mark: "đỏ", obs: "Quỳ tím hóa đỏ", note: "Dung dịch acid làm quỳ tím hóa đỏ", look: { paper: "red" } };
const LITMUS_BLUE = { r: 1, mark: "xanh", obs: "Quỳ tím hóa xanh", note: "Dung dịch base làm quỳ tím hóa xanh", look: { paper: "blue" } };
const none = note => ({ r: 0, mark: "–", obs: NONE, note, look: {} });

// TABLE[reagent][target] = { r: 1 reacted / 0 not, mark, obs, eq? | note?, look }.
// Equations use plain digits; ↑ marks a gas and ↓ a precipitate.
export const TABLE = {
  HCl: {
    quy: LITMUS_RED,
    Zn: { r: 1, mark: "↑ H₂", obs: "Kẽm tan dần, sủi bọt khí không màu (H₂)", eq: "Zn + 2HCl -> ZnCl2 + H2↑", look: { gas: true } },
    Fe: { r: 1, mark: "↑ H₂", obs: "Sắt tan dần, sủi bọt khí; dung dịch màu lục nhạt", eq: "Fe + 2HCl -> FeCl2 + H2↑", look: { gas: true, liquid: "green" } },
    Cu: none(CU),
    CuO: { r: 1, mark: "tan", obs: "Bột CuO màu đen tan dần, tạo dung dịch màu xanh lam", eq: "CuO + 2HCl -> CuCl2 + H2O", look: { solid: null, liquid: "blue" } },
    neut: { r: 1, mark: "mất hồng", obs: "Dung dịch NaOH (có phenolphthalein) mất màu hồng", eq: "HCl + NaOH -> NaCl + H2O", look: { liquid: "clear" } },
    CaCO3: { r: 1, mark: "↑ CO₂", obs: "Đá vôi tan dần, sủi bọt khí không màu (CO₂)", eq: "CaCO3 + 2HCl -> CaCl2 + CO2↑ + H2O", look: { gas: true } },
    BaCl2: none(NO_EXCHANGE),
    CuSO4: none(NO_EXCHANGE),
  },
  H2SO4: {
    quy: LITMUS_RED,
    Zn: { r: 1, mark: "↑ H₂", obs: "Kẽm tan dần, sủi bọt khí không màu (H₂)", eq: "Zn + H2SO4 -> ZnSO4 + H2↑", look: { gas: true } },
    Fe: { r: 1, mark: "↑ H₂", obs: "Sắt tan dần, sủi bọt khí; dung dịch màu lục nhạt", eq: "Fe + H2SO4 -> FeSO4 + H2↑", look: { gas: true, liquid: "green" } },
    Cu: none(CU),
    CuO: { r: 1, mark: "tan", obs: "Bột CuO màu đen tan dần, tạo dung dịch màu xanh lam", eq: "CuO + H2SO4 -> CuSO4 + H2O", look: { solid: null, liquid: "blue" } },
    neut: { r: 1, mark: "mất hồng", obs: "Dung dịch NaOH (có phenolphthalein) mất màu hồng", eq: "H2SO4 + 2NaOH -> Na2SO4 + 2H2O", look: { liquid: "clear" } },
    CaCO3: { r: 1, mark: "↑ CO₂", obs: "Sủi bọt khí CO₂ rồi chậm dần (CaSO₄ ít tan bám lên đá vôi)", eq: "CaCO3 + H2SO4 -> CaSO4 + CO2↑ + H2O", look: { gas: true } },
    BaCl2: { r: 1, mark: "↓ trắng", obs: "Xuất hiện kết tủa trắng (BaSO₄)", eq: "H2SO4 + BaCl2 -> BaSO4↓ + 2HCl", look: { ppt: "white" } },
    CuSO4: none(NO_EXCHANGE),
  },
  NaOH: {
    quy: LITMUS_BLUE,
    Zn: none(BASE_ZN),
    Fe: none(BASE_METAL),
    Cu: none(BASE_METAL),
    CuO: none(BASE_OXIDE),
    neut: { r: 1, mark: "hóa hồng", obs: "Khi base dư, dung dịch HCl (có phenolphthalein) hóa hồng", eq: "NaOH + HCl -> NaCl + H2O", look: { liquid: "pink" } },
    CaCO3: none(NO_EXCHANGE),
    BaCl2: none(NO_EXCHANGE),
    CuSO4: { r: 1, mark: "↓ xanh", obs: "Xuất hiện kết tủa xanh lam (Cu(OH)₂)", eq: "2NaOH + CuSO4 -> Cu(OH)2↓ + Na2SO4", look: { ppt: "blue", liquid: "clear" } },
  },
  CaOH2: {
    quy: LITMUS_BLUE,
    Zn: none(BASE_ZN),
    Fe: none(BASE_METAL),
    Cu: none(BASE_METAL),
    CuO: none(BASE_OXIDE),
    neut: { r: 1, mark: "hóa hồng", obs: "Khi base dư, dung dịch HCl (có phenolphthalein) hóa hồng", eq: "Ca(OH)2 + 2HCl -> CaCl2 + 2H2O", look: { liquid: "pink" } },
    CaCO3: none(NO_EXCHANGE),
    BaCl2: none(NO_EXCHANGE),
    CuSO4: { r: 1, mark: "↓ xanh", obs: "Xuất hiện kết tủa xanh lam Cu(OH)₂ (lẫn CaSO₄ ít tan)", eq: "Ca(OH)2 + CuSO4 -> Cu(OH)2↓ + CaSO4", look: { ppt: "blue", liquid: "clear" } },
  },
};

export const outcome = (reagent, target) => TABLE[reagent]?.[target] ?? null;

/** What is in the tube before (done = false) or after (done = true) the reagent is added. */
export function tubeLook(reagent, target, done) {
  const before = { ...TARGET_INFO[target].look };
  if (target === "neut") before.liquid = REAGENT_INFO[reagent].kind === "acid" ? "pink" : "clear";
  if (!done) return { ...before, level: before.liquid ? 0.3 : 0 };
  return { ...before, liquid: before.liquid ?? "clear", ...outcome(reagent, target).look, level: 0.62 };
}

/** Atom counts of one formula: "Ca(OH)2" → { Ca: 1, O: 2, H: 2 }. */
export function atoms(formula) {
  const out = {};
  const walk = (text, mult) => {
    for (const m of text.matchAll(/\(([^()]+)\)(\d*)|([A-Z][a-z]?)(\d*)/g)) {
      if (m[1]) walk(m[1], mult * (Number(m[2]) || 1));
      else out[m[3]] = (out[m[3]] || 0) + mult * (Number(m[4]) || 1);
    }
  };
  walk(formula, 1);
  return out;
}

/** True when both sides of "aA + bB -> cC + dD" hold the same atoms. */
export function balanced(eq) {
  const side = text => {
    const total = {};
    for (const term of text.split(" + ")) {
      const [, k, f] = term.trim().replace(/[↑↓]/g, "").match(/^(\d*)(.+)$/);
      for (const [e, n] of Object.entries(atoms(f))) total[e] = (total[e] || 0) + n * (Number(k) || 1);
    }
    return total;
  };
  const [l, r] = eq.split(" -> ").map(side);
  const keys = new Set([...Object.keys(l), ...Object.keys(r)]);
  return keys.size > 0 && [...keys].every(e => l[e] === r[e]);
}

// ---------- state ----------
const CELLS = REAGENTS.length * TARGETS.length;
const index = (reagent, target) => REAGENTS.indexOf(reagent) * TARGETS.length + TARGETS.indexOf(target);
/** `done` is not behind a control, so a forged value is replaced by an empty table. */
const cells = s => (typeof s.done === "string" && new RegExp(`^[01]{${CELLS}}$`).test(s.done) ? s.done : "0".repeat(CELLS));

export const isDone = (s, reagent, target) => cells(s)[index(reagent, target)] === "1";
export const doneCount = s => [...cells(s)].filter(c => c === "1").length;
export const complete = s => doneCount(s) === CELLS;
export const reactedCount = s => REAGENTS.reduce((n, r) => n + TARGETS.filter(t => isDone(s, r, t) && TABLE[r][t].r).length, 0);

/** Add the chosen reagent to the chosen target: fills that cell of the table, returns the outcome. */
export function perform(s) {
  const o = outcome(s.reagent, s.target);
  if (!o) return null;
  const i = index(s.reagent, s.target);
  const d = cells(s);
  s.done = d.slice(0, i) + "1" + d.slice(i + 1);
  return o;
}

export function initialState() {
  // One worked example (HCl + Zn) so the first picture already shows a reaction.
  const s = { reagent: "HCl", target: "Zn", done: "0".repeat(CELLS) };
  perform(s);
  return s;
}
