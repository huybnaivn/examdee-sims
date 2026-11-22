// A meal (starch, protein, lipid, water) moving through the human digestive tract.
// Each nutrient is a chain of pools, every pool a fraction (0..1) of that nutrient in the meal:
//   starch -> maltose -> glucose -> absorbed        protein -> peptide -> amino acid -> absorbed
//   lipid -> glycerol + fatty acids -> absorbed     water -> absorbed (small, then large intestine)
// An enzyme acts only in the organ it is placed in, and only if that organ's pH is in its working range.
// pH, transit times and rate constants are typical textbook values, chosen for illustration.

export const ORGANS = [
  { id: "mieng", name: "Miệng", pH: 7.2, hours: 1 / 60, time: "≈ 1 phút", seconds: 3, note: "Răng nghiền nhỏ, nước bọt làm mềm thức ăn." },
  { id: "da-day", name: "Dạ dày", pH: 2, hours: 4, time: "≈ 4 giờ", seconds: 5, note: "HCl tạo môi trường acid; dạ dày co bóp nhào trộn thức ăn." },
  { id: "ruot-non", name: "Ruột non", pH: 8, hours: 4, time: "≈ 4 giờ", seconds: 7, note: "Dịch mật nhũ tương hóa lipid; các sản phẩm cuối được hấp thụ qua thành ruột." },
  { id: "ruot-gia", name: "Ruột già", pH: 6.5, hours: 15, time: "≈ 15 giờ", seconds: 4, note: "Hấp thụ nước và tạo phân." },
];

// Fraction converted during one normal stay f gives the first-order rate k = −ln(1 − f) / hours.
const rate = (fraction, hours) => -Math.log(1 - fraction) / hours;
const FAST = 3; // 1/h: leaves e^-12 of the substrate after 4 h in the small intestine

// `key` is the state key holding the learner's placement in the matching challenge;
// enzymes without one (pancreatic amylase, peptidase) always sit in the small intestine.
export const ENZYMES = [
  { id: "amylase-nuoc-bot", name: "Amylase nước bọt", short: "Amylase", key: "pAmylase", organ: "mieng", from: "starch", to: "maltose", pH: [6, 8], k: rate(0.05, 1 / 60) },
  { id: "pepsin", name: "Pepsin", short: "Pepsin", key: "pPepsin", organ: "da-day", from: "protein", to: "peptide", pH: [1, 3.5], k: rate(0.15, 4) },
  { id: "amylase-tuy", name: "Amylase tụy", short: "Amylase tụy", organ: "ruot-non", from: "starch", to: "maltose", pH: [7, 9], k: FAST },
  { id: "maltase", name: "Maltase", short: "Maltase", key: "pMaltase", organ: "ruot-non", from: "maltose", to: "glucose", pH: [7, 9], k: FAST },
  { id: "trypsin", name: "Trypsin", short: "Trypsin", key: "pTrypsin", organ: "ruot-non", from: "protein", to: "peptide", pH: [7, 9], k: FAST },
  { id: "peptidase", name: "Peptidase", short: "Peptidase", organ: "ruot-non", from: "peptide", to: "amino", pH: [7, 9], k: FAST },
  { id: "lipase", name: "Lipase", short: "Lipase", key: "pLipase", organ: "ruot-non", from: "lipid", to: "glyFat", pH: [7, 9], k: FAST },
];
export const PLACEABLE = ENZYMES.filter(e => e.key);

export const POOL_NAMES = {
  starch: "tinh bột",
  maltose: "maltose",
  glucose: "glucose",
  protein: "protein",
  peptide: "peptide",
  amino: "amino acid",
  lipid: "lipid",
  glyFat: "glycerol + acid béo",
};

// Absorption: nutrients only through the small intestine wall; water mostly there, the rest in the large intestine.
const ABSORB = {
  "ruot-non": [["glucose", "absGlucose", 2], ["amino", "absAmino", 2], ["glyFat", "absGlyFat", 2], ["water", "absWaterSmall", rate(0.9, 4)]],
  "ruot-gia": [["water", "absWaterLarge", rate(0.9, 15)]],
};

const ENDS = ORGANS.map((_, i) => ORGANS.slice(0, i + 1).reduce((sum, o) => sum + o.hours, 0));
export const TOTAL = ENDS.at(-1); // hours from the first bite to the end of the large intestine

const freshMeal = () => ({
  t: 0, // hours since the meal entered the mouth
  starch: 1, maltose: 0, glucose: 0, absGlucose: 0,
  protein: 1, peptide: 0, amino: 0, absAmino: 0,
  lipid: 1, glyFat: 0, absGlyFat: 0,
  water: 1, absWaterSmall: 0, absWaterLarge: 0,
});
const POOLS = Object.keys(freshMeal()).filter(k => k !== "t");

export const initialState = () => ({
  mode: "body", // "body": enzymes where the body makes them; "quiz": the learner places them
  pAmylase: "none",
  pPepsin: "none",
  pMaltase: "none",
  pTrypsin: "none",
  pLipase: "none",
  speed: 1,
  ...freshMeal(),
});

export const newMeal = s => Object.assign(s, freshMeal());

/** Pools and time have no control, so a forged state is clamped here. */
export function normalize(s) {
  s.t = Math.min(TOTAL, Math.max(0, Number(s.t) || 0));
  for (const k of POOLS) s[k] = Math.min(1, Math.max(0, Number(s[k]) || 0));
  return s;
}

export const organIndex = t => Math.min(ORGANS.length - 1, ENDS.findIndex(end => t < end) >>> 0);
export const organAt = t => ORGANS[organIndex(t)];
/** Where the meal is: organ index and the fraction (0..1) of the stay in that organ already spent. */
export const position = t => {
  const i = organIndex(t);
  return { i, frac: Math.min(1, (t - (ENDS[i - 1] ?? 0)) / ORGANS[i].hours) };
};

export const placement = (s, enzyme) => (s.mode === "quiz" && enzyme.key ? s[enzyme.key] : enzyme.organ);
export const worksAt = (enzyme, organ) => organ.pH >= enzyme.pH[0] && organ.pH <= enzyme.pH[1];
/** Enzymes sitting in an organ, each with `active` = the organ's pH is in the enzyme's working range. */
export const enzymesIn = (s, organ) =>
  ENZYMES.filter(e => placement(s, e) === organ.id).map(e => ({ ...e, active: worksAt(e, organ) }));

const move = (s, from, to, k, h) => {
  const amount = s[from] * (1 - Math.exp(-k * h));
  s[from] -= amount;
  s[to] += amount;
};

/** Advance by dt seconds of animation; each organ takes `seconds` of it for its real `hours`. */
export function step(s, dt) {
  normalize(s);
  let left = dt;
  while (left > 1e-9 && s.t < TOTAL) {
    const i = organIndex(s.t);
    const organ = ORGANS[i];
    const perSecond = organ.hours / organ.seconds;
    let h = Math.min(left * perSecond, organ.hours / 400); // small sub-steps keep the chains accurate
    const atEnd = s.t + h >= ENDS[i] - 1e-12;
    if (atEnd) h = ENDS[i] - s.t;
    for (const e of enzymesIn(s, organ)) if (e.active) move(s, e.from, e.to, e.k, h);
    for (const [from, to, k] of ABSORB[organ.id] ?? []) move(s, from, to, k, h);
    s.t = atEnd ? ENDS[i] : s.t + h;
    left -= h / perSecond;
  }
  return s;
}

/** Run the rest of the meal to the end of the tract (or to hour `until`). */
export function run(s, until = TOTAL) {
  while (s.t < until - 1e-9 && s.t < TOTAL) step(s, 0.01);
  return s;
}

/** Fraction of each nutrient turned into its final product (absorbed or not). */
export const digested = s => ({
  starch: s.glucose + s.absGlucose,
  protein: s.amino + s.absAmino,
  lipid: s.glyFat + s.absGlyFat,
});
export const absorbed = s => ({
  starch: s.absGlucose,
  protein: s.absAmino,
  lipid: s.absGlyFat,
  water: s.absWaterSmall + s.absWaterLarge,
});

export const matchCount = s => PLACEABLE.filter(e => s[e.key] === e.organ).length;
export const matched = s => matchCount(s) === PLACEABLE.length;
