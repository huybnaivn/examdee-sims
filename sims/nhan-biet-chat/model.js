// Identifying six solutions with five reagents. Each test takes a fresh sample of the tube
// ("trích mẫu thử"), so the outcome depends only on (solution, reagent): no mixtures build up.

export const SOLUTIONS = ["HCl", "NaOH", "NaCl", "Na2SO4", "Na2CO3", "AgNO3"];
export const SOLUTION_NAMES = {
  HCl: "hydrochloric acid",
  NaOH: "sodium hydroxide",
  NaCl: "sodium chloride",
  Na2SO4: "sodium sulfate",
  Na2CO3: "sodium carbonate",
  AgNO3: "silver nitrate",
};
export const REAGENTS = ["q", "p", "b", "a", "h"];
export const REAGENT_NAMES = { q: "Quỳ tím", p: "Phenolphthalein", b: "BaCl₂", a: "AgNO₃", h: "HCl" };
export const REAGENT_SHORT = { q: "Quỳ", p: "PP", b: "BaCl₂", a: "AgNO₃", h: "HCl" };

/** Unicode subscripts for a formula written with plain digits: "Na2SO4" → "Na₂SO₄". */
export const pretty = f => f.replace(/\d/g, d => "₀₁₂₃₄₅₆₇₈₉"[d]).replace("->", "→");

// What the learner sees. Two outcomes with the same look cannot be told apart.
//   litmus: red / blue / purple (unchanged); phenolphthalein: pink / clear;
//   ppt-*: precipitate of that colour; gas: bubbles; clear: nothing visible.
export const LOOKS = {
  red: "Quỳ tím hóa đỏ",
  blue: "Quỳ tím hóa xanh",
  purple: "Quỳ tím không đổi màu",
  pink: "Dung dịch chuyển sang màu hồng",
  clear: "Không có hiện tượng",
  "ppt-white": "Xuất hiện kết tủa trắng",
  "ppt-yellow": "Xuất hiện kết tủa vàng nhạt",
  "ppt-black": "Xuất hiện kết tủa nâu đen",
  gas: "Sủi bọt khí không màu",
};

// Reaction table: TABLE[solution][reagent] = { look, eq?, note? }. Equations use plain digits.
const none = { look: "clear" };
export const TABLE = {
  HCl: {
    q: { look: "red", note: "dung dịch acid" },
    p: { look: "clear", note: "phenolphthalein không màu trong acid" },
    b: none,
    a: { look: "ppt-white", eq: "HCl + AgNO3 -> AgCl + HNO3", product: "AgCl" },
    h: { look: "clear", note: "cùng một chất" },
  },
  NaOH: {
    q: { look: "blue", note: "dung dịch base" },
    p: { look: "pink", note: "dung dịch base" },
    b: none,
    a: { look: "ppt-black", eq: "2NaOH + 2AgNO3 -> Ag2O + 2NaNO3 + H2O", product: "Ag2O" },
    h: { look: "clear", eq: "NaOH + HCl -> NaCl + H2O", note: "có phản ứng trung hòa nhưng không quan sát được" },
  },
  NaCl: {
    q: { look: "purple", note: "dung dịch trung tính" },
    p: { look: "clear" },
    b: none,
    a: { look: "ppt-white", eq: "NaCl + AgNO3 -> AgCl + NaNO3", product: "AgCl" },
    h: none,
  },
  Na2SO4: {
    q: { look: "purple", note: "dung dịch trung tính" },
    p: { look: "clear" },
    b: { look: "ppt-white", eq: "Na2SO4 + BaCl2 -> BaSO4 + 2NaCl", product: "BaSO4" },
    a: { look: "clear", note: "Ag₂SO₄ ít tan, dung dịch loãng không thấy kết tủa" },
    h: none,
  },
  Na2CO3: {
    q: { look: "blue", note: "dung dịch muối carbonate có tính base" },
    p: { look: "pink", note: "dung dịch muối carbonate có tính base" },
    b: { look: "ppt-white", eq: "Na2CO3 + BaCl2 -> BaCO3 + 2NaCl", product: "BaCO3" },
    a: { look: "ppt-yellow", eq: "Na2CO3 + 2AgNO3 -> Ag2CO3 + 2NaNO3", product: "Ag2CO3" },
    h: { look: "gas", eq: "Na2CO3 + 2HCl -> 2NaCl + CO2 + H2O", product: "CO2" },
  },
  AgNO3: {
    q: { look: "purple", note: "coi như trung tính" },
    p: { look: "clear" },
    b: { look: "ppt-white", eq: "2AgNO3 + BaCl2 -> 2AgCl + Ba(NO3)2", product: "AgCl" },
    a: { look: "clear", note: "cùng một chất" },
    h: { look: "ppt-white", eq: "AgNO3 + HCl -> AgCl + HNO3", product: "AgCl" },
  },
};

export const outcome = (solution, reagent) => TABLE[solution][reagent];

// best = fewest additions that identify every tube in the worst case (checked by model.test.js).
export const PRESETS = {
  "acid-base": { label: "3 lọ: HCl, NaOH, NaCl", solutions: ["HCl", "NaOH", "NaCl"], best: 2 },
  sulfate: { label: "4 lọ: HCl, NaOH, NaCl, Na₂SO₄", solutions: ["HCl", "NaOH", "NaCl", "Na2SO4"], best: 4 },
  salts: { label: "4 lọ: NaCl, Na₂SO₄, Na₂CO₃, AgNO₃", solutions: ["NaCl", "Na2SO4", "Na2CO3", "AgNO3"], best: 4 },
  all: { label: "6 lọ: cả sáu dung dịch", solutions: SOLUTIONS, best: 7 },
};

export const MAX_TUBES = 6;
const MAX_TESTS = 12; // per tube, so a forged state cannot grow without bound

export const initialState = () => ({
  preset: "sulfate",
  seed: 7, // decides which solution is in which tube
  reagent: "q",
  target: 1, // tube the "add" button drops into (1-based)
  // reagents added to tube k, in order, as a string of codes from REAGENTS
  t1: "", t2: "", t3: "", t4: "", t5: "", t6: "",
  // learner's label for tube k ("" = not labelled yet)
  l1: "", l2: "", l3: "", l4: "", l5: "", l6: "",
});

/** mulberry32 */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const preset = s => PRESETS[s.preset] ?? PRESETS.sulfate;

/** Hidden contents: tubes(s)[k] is the solution in tube k + 1. */
export function tubes(s) {
  const list = [...preset(s).solutions];
  const r = rng(Number.isFinite(s.seed) ? s.seed : 0);
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

/** Reagent codes added to tube k (0-based), cleaned of anything a forged state might hold. */
export const tests = (s, k) => [...String(s[`t${k + 1}`] ?? "")].filter(c => REAGENTS.includes(c)).slice(0, MAX_TESTS);

export const additions = s => tubes(s).reduce((n, _, k) => n + tests(s, k).length, 0);

/** Add a reagent to tube k (0-based). Returns the outcome, or null if the tube is full. */
export function addReagent(s, k, reagent) {
  const list = tests(s, k);
  if (list.length >= MAX_TESTS || !REAGENTS.includes(reagent) || k < 0 || k >= tubes(s).length) return null;
  s[`t${k + 1}`] = list.join("") + reagent;
  return outcome(tubes(s)[k], reagent);
}

export function clearRound(s) {
  for (let k = 1; k <= MAX_TUBES; k++) s[`t${k}`] = s[`l${k}`] = "";
  s.target = 1;
}

export const labels = s => tubes(s).map((_, k) => s[`l${k + 1}`]);
export const allLabelled = s => labels(s).every(Boolean);
export const correctCount = s => tubes(s).filter((sol, k) => s[`l${k + 1}`] === sol).length;

// ---------- reasoning: which assignments are still possible ----------

function permutations(list) {
  if (list.length <= 1) return [list];
  return list.flatMap((x, i) => permutations([...list.slice(0, i), ...list.slice(i + 1)]).map(p => [x, ...p]));
}

/** Assignments of the preset's solutions to tubes that agree with everything observed so far. */
export function consistent(s) {
  const obs = tubes(s).flatMap((sol, k) => tests(s, k).map(r => [k, r, outcome(sol, r).look]));
  return permutations(preset(s).solutions).filter(p => obs.every(([k, r, look]) => outcome(p[k], r).look === look));
}

/** True when the observations leave exactly one possible assignment. */
export const determined = s => consistent(s).length === 1;

/**
 * Fewest additions that always identify every tube, whatever the hidden order (adaptive strategy,
 * the last tube may be named by elimination). Iterative deepening over sets of possible assignments.
 */
export function fewestAdditions(solutions) {
  const perms = permutations(solutions);
  const n = solutions.length;
  const memo = new Map(); // set key → largest depth known to fail, or -1 - (depth known to succeed)
  const solved = set => perms[set[0]].every((sol, k) => set.every(i => perms[i][k] === sol));
  const can = (set, depth) => {
    if (solved(set)) return true;
    if (depth === 0) return false;
    const key = set.join(",");
    const known = memo.get(key);
    if (known !== undefined && (known < 0 ? -1 - known <= depth : known >= depth)) return known < 0;
    for (let k = 0; k < n; k++) {
      for (const r of REAGENTS) {
        const parts = new Map();
        for (const i of set) {
          const look = outcome(perms[i][k], r).look;
          if (!parts.has(look)) parts.set(look, []);
          parts.get(look).push(i);
        }
        if (parts.size < 2) continue; // learns nothing
        if ([...parts.values()].every(p => can(p, depth - 1))) {
          memo.set(key, -1 - depth);
          return true;
        }
      }
    }
    memo.set(key, Math.max(depth, known >= 0 ? known : 0));
    return false;
  };
  const all = perms.map((_, i) => i);
  for (let d = 0; ; d++) if (can(all, d)) return d;
}
