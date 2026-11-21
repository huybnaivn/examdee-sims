// Corrosion of iron nails in seven test tubes. Pure logic, no DOM.
//
// Rust needs water AND oxygen. Relative rates are a qualitative teaching scale, not measured data:
// what textbooks document is the ORDER (Fe–Cu in salt water > salt water > tap water > the rest ≈ 0).
// ponytail: SALT_FACTOR and CU_FACTOR only fix that order; replace with measured rates if ever needed.

export const DAYS = 10; // length of the observation, days
export const K = 0.06; // 1/day per unit of relative rate, sets how fast the drawn rust builds up
export const SALT_FACTOR = 3; // NaCl solution conducts better, electrochemical corrosion is faster
export const CU_FACTOR = 2; // Fe is the anode of an Fe–Cu cell, corrodes faster than alone

// Standard electrode potentials E° (V), for the explanation text.
export const E0 = { Zn: -0.763, Fe: -0.44, Cu: 0.34 };

export const TUBES = [
  { short: "Dầu", name: "Nước cất đã đun sôi, phủ lớp dầu", water: true, oxygen: false, salt: false, partner: null, coated: false },
  { short: "Khô", name: "Không khí khô, có CaCl₂ khan hút ẩm", water: false, oxygen: true, salt: false, partner: null, coated: false },
  { short: "Nước", name: "Nước máy, hở miệng ống", water: true, oxygen: true, salt: false, partner: null, coated: false },
  { short: "Muối", name: "Nước muối NaCl, hở miệng ống", water: true, oxygen: true, salt: true, partner: null, coated: false },
  { short: "Fe–Zn", name: "Nước muối, đinh sắt nối với thanh kẽm", water: true, oxygen: true, salt: true, partner: "Zn", coated: false },
  { short: "Fe–Cu", name: "Nước muối, đinh sắt nối với dây đồng", water: true, oxygen: true, salt: true, partner: "Cu", coated: false },
  { short: "Sơn", name: "Nước muối, đinh sắt được sơn phủ", water: true, oxygen: true, salt: true, partner: null, coated: true },
];

// The correct top three (tube indices), fastest first. Everything else does not rust.
export const TOP3 = [5, 3, 2];

export const initialState = () => ({
  day: 0, // days since the nails were put in
  focus: 5, // tube whose explanation is shown (0–6)
  showTheory: false, // show chemical vs electrochemical corrosion instead of the tube note
  p1: -1, // predicted fastest tube (−1 not chosen)
  p2: -1,
  p3: -1,
  reported: false, // the end-of-run result has been sent for this run
  verdict: -1, // −1 not judged, 0 wrong, 1 right
});

/** Relative rusting rate of the iron nail in tube i (0 = no rust). */
export function ironRate(i) {
  const t = TUBES[i];
  if (!t || !t.water || !t.oxygen || t.coated) return 0; // both water and oxygen must reach bare iron
  if (t.partner === "Zn") return 0; // Zn is the anode and is sacrificed, Fe is the cathode
  let rate = 1;
  if (t.salt) rate *= SALT_FACTOR;
  if (t.partner === "Cu") rate *= CU_FACTOR;
  return rate;
}

/** Relative corrosion rate of the partner metal (only zinc corrodes, as the anode). */
export function partnerRate(i) {
  const t = TUBES[i];
  return t?.partner === "Zn" ? (t.salt ? SALT_FACTOR : 1) : 0;
}

const amount = (rate, day) => 1 - Math.exp(-K * rate * Math.max(0, day));
/** Fraction of the wet nail surface covered in rust, 0–1. */
export const rust = (i, day) => amount(ironRate(i), day);
/** Fraction of the zinc bar eaten away, 0–1. */
export const zincLoss = (i, day) => amount(partnerRate(i), day);

/** Tube indices from most to least rust; ties keep tube order. */
export const ranking = () => TUBES.map((_, i) => i).sort((a, b) => ironRate(b) - ironRate(a) || a - b);

/** Competition rank of each tube (1 = most rust, ties share a rank). */
export const ranks = () => TUBES.map((_, i) => 1 + TUBES.filter((_, j) => ironRate(j) > ironRate(i)).length);

export const predictionComplete = s => [s.p1, s.p2, s.p3].every(p => p >= 0);
export const predictionCorrect = s => [s.p1, s.p2, s.p3].every((p, k) => p === TOP3[k]);

/** Advance time. Returns true when the run has just reached the last day. */
export function step(s, dt) {
  s.day = Math.min(DAYS, Math.max(0, s.day) + dt);
  return s.day >= DAYS;
}
