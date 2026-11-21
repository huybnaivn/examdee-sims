// Mitosis and meiosis of a cell with 2n = 4, 6 or 8.
// The model builds the actual contents of every cell at every step (which chromosomes, how many
// chromatids each); all counts are computed from those contents, so the picture and the numbers
// cannot disagree.
//
// A chromosome is { pair, parent, chromatids, pole }:
//   pair      0 … n − 1, pair 0 is the largest
//   parent    0 = from the mother, 1 = from the father
//   chromatids [{ base, tip }]: one (đơn, unreplicated or separated) or two (kép, sister chromatids);
//              base / tip give the parent each part comes from (they differ after crossing over)
//   pole      −1 / +1 while chromosomes are moving to (or lined up towards) a pole, else 0

export const MITOSIS = [
  "Kì trung gian (trước khi nhân đôi NST)",
  "Kì trung gian (sau khi nhân đôi NST)",
  "Kì đầu",
  "Kì giữa",
  "Kì sau",
  "Kì cuối",
];
export const MEIOSIS = [
  "Kì trung gian (trước khi nhân đôi NST)",
  "Kì trung gian (sau khi nhân đôi NST)",
  "Kì đầu I",
  "Kì giữa I",
  "Kì sau I",
  "Kì cuối I",
  "Kì đầu II",
  "Kì giữa II",
  "Kì sau II",
  "Kì cuối II",
];

export const initialState = () => ({
  type: "mitosis", // "mitosis" (nguyên phân) or "meiosis" (giảm phân)
  n2: 4, // diploid number 2n: 4, 6 or 8
  phase: 0, // step of the division, 0 … phases − 1
  orient: 0, // meiosis I: bit i = 1 sends the father's chromosome of pair i to the upper pole
  crossing: false, // crossing over between non-sister chromatids of the largest pair (pair 0)
  speed: 1, // steps per 1,5 s when playing
  quiz: false, // quiz mode: counts hidden, the learner predicts them
  guess: 4, // predicted number of chromosomes per cell
  guessKind: "kep", // predicted state: "don" (đơn) or "kep" (kép)
  answer: "", // "" not checked yet, "right" or "wrong"
});

export const phasesOf = s => (s.type === "meiosis" ? MEIOSIS : MITOSIS);
const nOf = s => ([4, 6, 8].includes(s.n2) ? s.n2 / 2 : 2);
export const phaseOf = s => Math.min(phasesOf(s).length - 1, Math.max(0, Math.floor(s.phase) || 0));
export const orientOf = s => (Math.floor(s.orient) || 0) & ((1 << nOf(s)) - 1);

const replicate = c => ({ ...c, chromatids: [c.chromatids[0], { ...c.chromatids[0] }] });
const split = c => c.chromatids.map((ct, i) => ({ pair: c.pair, parent: c.parent, chromatids: [ct], pole: i ? 1 : -1 }));
const at = (c, pole) => ({ ...c, pole });

/** The cells shown at the current step: [{ layout, chromosomes }]. */
export function cells(s) {
  const n = nOf(s);
  const ph = phaseOf(s);
  const single = [];
  for (let pair = 0; pair < n; pair++) for (const parent of [0, 1]) single.push({ pair, parent, chromatids: [{ base: parent, tip: parent }], pole: 0 });
  if (ph === 0) return [{ layout: "interphase", chromosomes: single }];
  let doubled = single.map(replicate);
  if (ph === 1) return [{ layout: "interphase", chromosomes: doubled }];

  if (s.type !== "meiosis") {
    if (ph === 2) return [{ layout: "prophase", chromosomes: doubled }];
    if (ph === 3) return [{ layout: "plate", chromosomes: doubled }];
    const separated = doubled.flatMap(split);
    if (ph === 4) return [{ layout: "poles", chromosomes: separated }];
    return [-1, 1].map(p => ({ layout: "telophase", chromosomes: separated.filter(c => c.pole === p).map(c => at(c, 0)) }));
  }

  // crossing over: chromatid 1 of the mother's and chromatid 0 of the father's chromosome of pair 0 swap tips
  if (s.crossing) {
    doubled = doubled.map(c =>
      c.pair !== 0 ? c : { ...c, chromatids: c.chromatids.map((ct, i) => (i === 1 - c.parent ? { ...ct, tip: 1 - c.parent } : ct)) }
    );
  }
  if (ph === 2) return [{ layout: "synapsis", chromosomes: doubled }];
  // random arrangement of each pair on the plate: which homologue faces the upper pole (−1)
  const orient = orientOf(s);
  const placed = doubled.map(c => at(c, c.parent === ((orient >> c.pair) & 1) ? -1 : 1));
  if (ph === 3) return [{ layout: "plate2", chromosomes: placed }];
  if (ph === 4) return [{ layout: "poles", chromosomes: placed }];
  const halves = [-1, 1].map(p => placed.filter(c => c.pole === p).map(c => at(c, 0)));
  if (ph === 5) return halves.map(chromosomes => ({ layout: "telophase", chromosomes }));
  if (ph === 6) return halves.map(chromosomes => ({ layout: "prophase", chromosomes }));
  if (ph === 7) return halves.map(chromosomes => ({ layout: "plate", chromosomes }));
  const second = halves.map(h => h.flatMap(split));
  if (ph === 8) return second.map(chromosomes => ({ layout: "poles", chromosomes }));
  return second.flatMap(h => [-1, 1].map(p => ({ layout: "telophase", chromosomes: h.filter(c => c.pole === p).map(c => at(c, 0)) })));
}

/**
 * Counts in one cell, as in the textbook tables: a chromosome is "kép" when it has two sister
 * chromatids; a single (đơn) chromosome is counted as 0 chromatids. One centromere per chromosome.
 */
export function counts(cell) {
  const chromosomes = cell.chromosomes.length;
  const kep = cell.chromosomes.filter(c => c.chromatids.length === 2).length;
  return {
    chromosomes,
    kind: kep === chromosomes ? "kep" : kep === 0 ? "don" : "mixed",
    chromatids: 2 * kep,
    centromeres: chromosomes,
  };
}

/** Gamete (or daughter cell) signature: for each pair, the parents of its chromatid as "base/tip". */
export const signature = cell =>
  cell.chromosomes
    .map(c => `${c.pair}:${c.chromatids.map(ct => `${ct.base}${ct.tip}`).join("")}`)
    .sort()
    .join(" ");

/** All different gametes meiosis can give for this 2n, over every arrangement of the pairs. */
export function gameteTypes(n2, crossing = false) {
  const n = n2 / 2;
  const types = new Set();
  for (let orient = 0; orient < 1 << n; orient++) {
    for (const cell of cells({ type: "meiosis", n2, phase: MEIOSIS.length - 1, orient, crossing })) types.add(signature(cell));
  }
  return types;
}

/** Correct answer for the quiz at the current step (all cells of a step are alike). */
export const answerOf = s => counts(cells(s)[0]);

export const isRight = s => {
  const a = answerOf(s);
  return s.guess === a.chromosomes && s.guessKind === a.kind;
};
