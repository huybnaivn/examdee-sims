// Cellular respiration of one glucose molecule, textbook bookkeeping.
//
// Aerobic stages (classic count, as in Vietnamese textbooks: 1 NADH → 3 ATP, 1 FADH₂ → 2 ATP):
//   Đường phân            tế bào chất       +2 ATP (net: 4 made − 2 used), 2 NADH → 2 pyruvic acid
//   Oxi hoá pyruvic acid  chất nền ti thể    2 NADH, 2 CO₂ → 2 acetyl-CoA
//   Chu trình Krebs       chất nền ti thể   +2 ATP, 6 NADH, 2 FADH₂, 4 CO₂
//   Chuỗi truyền electron màng trong ti thể  10 NADH·3 + 2 FADH₂·2 = 34 ATP, uses 6 O₂, gives H₂O
//   Total 38 ATP. (Measured yields are lower, about 30–32 ATP; the sim says so on screen.)
// Without O₂ the electron transport chain stops (O₂ is the final electron acceptor), NADH cannot be
// reoxidised there, so cells ferment: pyruvic acid → lactic acid, or → ethanol + CO₂; only the
// 2 ATP of glycolysis remain.
// Oxygen model (illustrative): oxygen is given in % of the normal level; the share of glucose
// respired aerobically is min(1, O₂ / 25 %); the rest is fermented. Average ATP per glucose =
// 38·share + 2·(1 − share).

export const ATP_PER_NADH = 3;
export const ATP_PER_FADH2 = 2;
export const FULL_AEROBIC_AT = 25; // % of normal oxygen

export const STAGES = [
  { name: "Đường phân", place: "Tế bào chất", atp: 2, nadh: 2, fadh2: 0, co2: 0, out: "2 pyruvic acid" },
  { name: "Oxi hoá pyruvic acid", place: "Chất nền ti thể", atp: 0, nadh: 2, fadh2: 0, co2: 2, out: "2 acetyl-CoA" },
  { name: "Chu trình Krebs", place: "Chất nền ti thể", atp: 2, nadh: 6, fadh2: 2, co2: 4, out: "10 NADH, 2 FADH₂" },
  { name: "Chuỗi truyền electron", place: "Màng trong ti thể", atp: null, nadh: 0, fadh2: 0, co2: 0, out: "H₂O" },
];

export const FERMENTATION = {
  lactic: { name: "Lên men lactic", short: "Lên men lactic", where: "tế bào cơ khi thiếu O₂, vi khuẩn lactic", product: "lactic acid", formula: { C: 3, H: 6, O: 3 }, co2: 0 },
  ethanol: { name: "Lên men rượu (ethanol)", short: "Lên men rượu", where: "nấm men", product: "ethanol", formula: { C: 2, H: 6, O: 1 }, co2: 2 },
};

export const GLUCOSE = { C: 6, H: 12, O: 6 };
export const O2 = { O: 2 };
export const CO2 = { C: 1, O: 2 };
export const H2O = { H: 2, O: 1 };

// The order the learner has to rebuild in the quiz, and how the cards are shuffled on screen.
export const CARD_ORDER = [2, 0, 3, 1];

export const initialState = () => ({
  oxygen: 100, // % of normal
  fermentation: "lactic", // "lactic" | "ethanol"
  quiz: false, // ordering challenge on
  placed: 0, // stages already put in the right order (0..4)
  mistakes: 0,
  pick: -1, // keyboard picker for the quiz, −1 = nothing chosen
});

const num = (v, lo, hi, d) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);

/** ATP made by the electron transport chain from all NADH and FADH₂ of the earlier stages. */
export function etcAtp() {
  const nadh = STAGES.reduce((a, st) => a + st.nadh, 0);
  const fadh2 = STAGES.reduce((a, st) => a + st.fadh2, 0);
  return nadh * ATP_PER_NADH + fadh2 * ATP_PER_FADH2;
}

/** ATP per glucose of each aerobic stage. */
export const stageAtp = () => STAGES.map(st => st.atp ?? etcAtp());

export const AEROBIC_ATP = stageAtp().reduce((a, b) => a + b, 0);
export const FERMENT_ATP = STAGES[0].atp;

/** Share of glucose respired aerobically at an oxygen level (% of normal). */
export const aerobicShare = oxygen => Math.min(1, num(oxygen, 0, 100, 0) / FULL_AEROBIC_AT);

/** 0 = only fermentation, 1 = both, 2 = only aerobic respiration. */
export const pathway = oxygen => {
  const a = aerobicShare(oxygen);
  return a === 0 ? 0 : a === 1 ? 2 : 1;
};

export const atpPerGlucose = oxygen => {
  const a = aerobicShare(oxygen);
  return AEROBIC_ATP * a + FERMENT_ATP * (1 - a);
};

/** The electron transport chain runs only with oxygen as the final electron acceptor. */
export const etcRuns = oxygen => aerobicShare(oxygen) > 0;

/** Atom counts of a side of an equation: [[coefficient, formula], ...]. */
export function atoms(side) {
  const total = {};
  for (const [n, f] of side) for (const [el, k] of Object.entries(f)) total[el] = (total[el] ?? 0) + n * k;
  return total;
}

export const EQUATIONS = {
  aerobic: { left: [[1, GLUCOSE], [6, O2]], right: [[6, CO2], [6, H2O]] },
  lactic: { left: [[1, GLUCOSE]], right: [[2, FERMENTATION.lactic.formula]] },
  ethanol: { left: [[1, GLUCOSE]], right: [[2, FERMENTATION.ethanol.formula], [2, CO2]] },
};

/** Quiz: the learner picks stage k (index in the true order). Returns { correct, done }. */
export function pickStage(s, k) {
  const placed = num(Math.floor(s.placed), 0, STAGES.length, 0);
  if (!Number.isInteger(k) || k < 0 || k >= STAGES.length || placed >= STAGES.length) return { correct: false, done: false };
  if (k !== placed) {
    s.mistakes = num(s.mistakes, 0, 1e6, 0) + 1;
    return { correct: false, done: false };
  }
  s.placed = placed + 1;
  return { correct: true, done: s.placed === STAGES.length };
}
