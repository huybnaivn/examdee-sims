import test from "node:test";
import assert from "node:assert/strict";
import {
  initialState, STAGES, stageAtp, etcAtp, AEROBIC_ATP, FERMENT_ATP, aerobicShare, pathway, atpPerGlucose,
  etcRuns, atoms, EQUATIONS, FERMENTATION, pickStage, CARD_ORDER,
} from "./model.js";

test("ATP per stage and total follow the textbook count (1 NADH → 3 ATP, 1 FADH₂ → 2 ATP)", () => {
  assert.deepEqual(stageAtp(), [2, 0, 2, 34]);
  assert.equal(etcAtp(), 10 * 3 + 2 * 2);
  assert.equal(AEROBIC_ATP, 38);
  assert.equal(STAGES.reduce((a, st) => a + st.nadh, 0), 10);
  assert.equal(STAGES.reduce((a, st) => a + st.fadh2, 0), 2);
  assert.equal(STAGES.reduce((a, st) => a + st.co2, 0), 6); // all six carbons of glucose leave as CO₂
});

test("fermentation gives only the 2 ATP of glycolysis", () => {
  assert.equal(FERMENT_ATP, 2);
  assert.equal(atpPerGlucose(0), 2);
  assert.equal(atpPerGlucose(100), 38);
  assert.equal(atpPerGlucose(12.5), 20); // half aerobic: (38 + 2) / 2
});

test("C₆H₁₂O₆ + 6O₂ → 6CO₂ + 6H₂O and both fermentations are balanced", () => {
  for (const [name, eq] of Object.entries(EQUATIONS)) assert.deepEqual(atoms(eq.left), atoms(eq.right), name);
  assert.deepEqual(atoms(EQUATIONS.aerobic.left), { C: 6, H: 12, O: 18 });
});

test("no oxygen means no electron transport chain", () => {
  assert.equal(etcRuns(0), false);
  assert.equal(pathway(0), 0);
  assert.equal(etcRuns(5), true);
  assert.equal(pathway(5), 1);
  assert.equal(pathway(25), 2);
  assert.equal(pathway(100), 2);
  // more oxygen never lowers the yield
  let prev = 0;
  for (let o = 0; o <= 100; o += 5) {
    assert.ok(atpPerGlucose(o) >= prev);
    prev = atpPerGlucose(o);
  }
  assert.equal(aerobicShare(-50), 0);
  assert.equal(aerobicShare(1e9), 1);
});

test("fermentation products", () => {
  assert.equal(FERMENTATION.lactic.product, "lactic acid");
  assert.equal(FERMENTATION.lactic.co2, 0);
  assert.equal(FERMENTATION.ethanol.product, "ethanol");
  assert.equal(FERMENTATION.ethanol.co2, 2);
  assert.deepEqual(FERMENTATION.lactic.formula, { C: 3, H: 6, O: 3 }); // C₃H₆O₃
  assert.deepEqual(FERMENTATION.ethanol.formula, { C: 2, H: 6, O: 1 }); // C₂H₅OH
});

test("ordering quiz: stages must be picked glycolysis → pyruvate oxidation → Krebs → ETC", () => {
  assert.deepEqual([...CARD_ORDER].sort(), [0, 1, 2, 3]);
  const s = initialState();
  assert.deepEqual(pickStage(s, 2), { correct: false, done: false });
  const r = [0, 1, 2, 3].map(k => pickStage(s, k));
  assert.ok(r.every(x => x.correct));
  assert.equal(r.filter(x => x.done).length, 1);
  assert.equal(r[3].done, true);
  assert.equal(s.mistakes, 1);
  assert.equal(pickStage(s, 0).correct, false); // finished: nothing more to place
  assert.equal(pickStage({ ...initialState(), placed: -3 }, 0).correct, true);
});
