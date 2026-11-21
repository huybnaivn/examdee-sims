// Two-stage experiment: first B or B̄, then A or Ā. Notation as in the grade 12 textbook:
// P(A|B) is the probability of A given B; Bayes: P(B|A) = P(B)·P(A|B) / P(A).

export const SCENARIOS = {
  benh: {
    B: "Mắc bệnh",
    NB: "Không mắc bệnh",
    A: "Dương tính",
    NA: "Âm tính",
    unit: "người",
    trial: "Chọn ngẫu nhiên một người rồi xét nghiệm",
    preset: { pB: 0.02, pAB: 0.95, pANB: 0.1 },
  },
  hop: {
    B: "Chọn hộp I",
    NB: "Chọn hộp II",
    A: "Bi đỏ",
    NA: "Bi xanh",
    unit: "lần",
    trial: "Chọn một hộp rồi lấy ngẫu nhiên một viên bi",
    preset: { pB: 0.5, pAB: 0.7, pANB: 0.3 },
  },
  may: {
    B: "Máy I sản xuất",
    NB: "Máy II sản xuất",
    A: "Phế phẩm",
    NA: "Chính phẩm",
    unit: "sản phẩm",
    trial: "Lấy ngẫu nhiên một sản phẩm trong kho",
    preset: { pB: 0.6, pAB: 0.03, pANB: 0.05 },
  },
};

export const N = 1000; // size of the frequency picture

export const initialState = () => ({
  scenario: "benh",
  ...SCENARIOS.benh.preset,
  view: "both",
});

const prob = v => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

/** Every probability on the tree and the formulas built from it. */
export function tree(s) {
  const pB = prob(s.pB);
  const pAB = prob(s.pAB);
  const pANB = prob(s.pANB);
  const pNB = 1 - pB;
  const joint = { BA: pB * pAB, BNA: pB * (1 - pAB), NBA: pNB * pANB, NBNA: pNB * (1 - pANB) };
  const pA = joint.BA + joint.NBA; // total probability
  const pNA = joint.BNA + joint.NBNA;
  return {
    pB,
    pNB,
    pAB,
    pNAB: 1 - pAB,
    pANB,
    pNANB: 1 - pANB,
    joint,
    pA,
    pNA,
    pBA: pA > 0 ? joint.BA / pA : NaN, // Bayes, undefined when A cannot happen
    pNBA: pA > 0 ? joint.NBA / pA : NaN,
    pBNA: pNA > 0 ? joint.BNA / pNA : NaN,
    // A and B independent ⇔ P(A∩B) = P(A)·P(B) ⇔ (when 0 < P(B) < 1) P(A|B) = P(A|B̄)
    independent: Math.abs(joint.BA - pA * pB) < 1e-9,
  };
}

/** Integers proportional to `weights` that add up to exactly `total` (largest remainder method). */
export function largestRemainder(weights, total) {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!(sum > 0)) return weights.map(() => 0);
  const exact = weights.map(w => (w / sum) * total);
  const out = exact.map(Math.floor);
  let left = total - out.reduce((a, b) => a + b, 0);
  const order = exact.map((e, i) => [e - Math.floor(e), i]).sort((x, y) => y[0] - x[0] || x[1] - y[1]);
  for (let k = 0; left > 0; k++, left--) out[order[k % order.length][1]]++;
  return out;
}

/** How many of N cases fall in B∩A, B∩Ā, B̄∩A, B̄∩Ā. */
export function counts(s, total = N) {
  const j = tree(s).joint;
  const [BA, BNA, NBA, NBNA] = largestRemainder([j.BA, j.BNA, j.NBA, j.NBNA], total);
  return { BA, BNA, NBA, NBNA, B: BA + BNA, A: BA + NBA };
}
