import test from "node:test";
import assert from "node:assert/strict";
import { initialState, tree, counts, largestRemainder, SCENARIOS } from "./model.js";

const close = (a, b, eps = 1e-12) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);
const cases = [
  initialState(),
  ...Object.values(SCENARIOS).map(sc => ({ ...initialState(), ...sc.preset })),
  { pB: 0, pAB: 0.3, pANB: 0.8 },
  { pB: 1, pAB: 0.3, pANB: 0.8 },
  { pB: 0.37, pAB: 0, pANB: 0 },
  { pB: 0.41, pAB: 1, pANB: 0.13 },
];

test("branches from each node add up to 1, and so do the four leaves", () => {
  for (const s of cases) {
    const t = tree(s);
    close(t.pB + t.pNB, 1);
    close(t.pAB + t.pNAB, 1);
    close(t.pANB + t.pNANB, 1);
    close(t.joint.BA + t.joint.BNA + t.joint.NBA + t.joint.NBNA, 1);
    close(t.pA + t.pNA, 1);
  }
});

test("multiplication rule P(A∩B) = P(B)·P(A|B) = P(A)·P(B|A)", () => {
  for (const s of cases) {
    const t = tree(s);
    close(t.joint.BA, t.pB * t.pAB);
    if (t.pA > 0) close(t.joint.BA, t.pA * t.pBA);
  }
});

test("total probability P(A) = P(B)·P(A|B) + P(B̄)·P(A|B̄): the disease example", () => {
  const t = tree({ pB: 0.02, pAB: 0.95, pANB: 0.1 });
  close(t.pA, 0.02 * 0.95 + 0.98 * 0.1);
  close(t.pA, 0.117);
});

test("Bayes P(B|A) = P(B)·P(A|B) / P(A), and P(B|A) + P(B̄|A) = 1", () => {
  const t = tree({ pB: 0.02, pAB: 0.95, pANB: 0.1 });
  close(t.pBA, 0.019 / 0.117);
  assert.equal(t.pBA.toFixed(3), "0.162"); // a positive test still means only about 16 %
  close(t.pBA + t.pNBA, 1);
  // two boxes, equal choice: 7 red of 10 and 3 red of 10 → P(box I | red) = 0.7
  close(tree({ pB: 0.5, pAB: 0.7, pANB: 0.3 }).pBA, 0.7);
  // A impossible: P(B|A) is undefined, not NaN leaking into a sum
  assert.ok(Number.isNaN(tree({ pB: 0.5, pAB: 0, pANB: 0 }).pBA));
});

test("largest remainder gives integers that add up exactly", () => {
  assert.deepEqual(largestRemainder([1, 1, 1], 100), [34, 33, 33]);
  assert.deepEqual(largestRemainder([0, 0], 10), [0, 0]);
  for (let k = 0; k < 200; k++) {
    const w = [Math.random(), Math.random(), Math.random(), Math.random()];
    const out = largestRemainder(w, 1000);
    assert.equal(out.reduce((a, b) => a + b, 0), 1000);
    const sum = w.reduce((a, b) => a + b, 0);
    out.forEach((n, i) => assert.ok(Math.abs(n - (w[i] / sum) * 1000) < 1));
  }
});

test("the 1000-case grid matches the probabilities", () => {
  const c = counts({ pB: 0.02, pAB: 0.95, pANB: 0.1 });
  assert.deepEqual(c, { BA: 19, BNA: 1, NBA: 98, NBNA: 882, B: 20, A: 117 });
  for (const s of cases) {
    const n = counts(s);
    const t = tree(s);
    assert.equal(n.BA + n.BNA + n.NBA + n.NBNA, 1000);
    assert.ok(Math.abs(n.A - t.pA * 1000) < 2);
    assert.ok(Math.abs(n.BA - t.joint.BA * 1000) < 1);
  }
  // rounding that does not add up naively: 1/3 each way
  const third = counts({ pB: 1 / 3, pAB: 0.5, pANB: 0.5 });
  assert.equal(third.BA + third.BNA + third.NBA + third.NBNA, 1000);
});

test("independence: A and B independent exactly when P(A|B) = P(A|B̄)", () => {
  assert.equal(tree({ pB: 0.3, pAB: 0.4, pANB: 0.4 }).independent, true);
  close(tree({ pB: 0.3, pAB: 0.4, pANB: 0.4 }).pA, 0.4);
  assert.equal(tree({ pB: 0.3, pAB: 0.4, pANB: 0.41 }).independent, false);
  assert.equal(tree(initialState()).independent, false);
});

test("forged probabilities outside [0, 1] are clamped", () => {
  const t = tree({ pB: 7, pAB: -1, pANB: NaN });
  assert.equal(t.pB, 1);
  assert.equal(t.pAB, 0);
  assert.equal(t.pANB, 0);
});
