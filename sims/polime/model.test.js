import test from "node:test";
import assert from "node:assert/strict";
import { POLYMERS, polymerById, parseFormula, molarMass, monomerMass, unitMass, polymerMass, degreeFromMass, waterReleased, isCondensation, targetOf, newTarget, step, initialState, SHOW } from "./model.js";

test("monomer molar masses (C = 12, H = 1, O = 16, N = 14, Cl = 35,5)", () => {
  const want = { pe: 28, pp: 42, pvc: 62.5, ps: 104, capron: 113, buna: 54, nylon66: 116 + 146 };
  for (const p of POLYMERS) assert.equal(monomerMass(p), want[p.id], p.id);
});

test("repeating unit: same atoms as the monomer(s), minus water for condensation", () => {
  for (const p of POLYMERS) {
    const sum = {};
    for (const m of p.monomers) for (const [el, k] of Object.entries(parseFormula(m.formula))) sum[el] = (sum[el] ?? 0) + k;
    sum.H -= 2 * p.water;
    if (p.water) sum.O -= p.water;
    assert.deepEqual(parseFormula(p.unit), sum, p.id);
    assert.equal(molarMass(p.unit), unitMass(p), p.id);
  }
});

test("M = n × monomer mass for addition, n × (monomers − 2 H2O) for nylon-6,6", () => {
  assert.equal(polymerMass(polymerById("pe"), 1000), 28000);
  assert.equal(polymerMass(polymerById("pvc"), 2000), 125000);
  assert.equal(polymerMass(polymerById("nylon66"), 100), 100 * (116 + 146 - 36));
  assert.equal(unitMass(polymerById("nylon66")), 226);
  assert.equal(isCondensation(polymerById("nylon66")), true);
  assert.equal(POLYMERS.filter(isCondensation).length, 1);
});

test("n from a given molar mass", () => {
  assert.equal(degreeFromMass(polymerById("pe"), 420000), 15000);
  assert.equal(degreeFromMass(polymerById("pvc"), 250000), 4000);
  assert.equal(degreeFromMass(polymerById("capron"), 113000), 1000);
  for (const p of POLYMERS) assert.equal(degreeFromMass(p, polymerMass(p, 3700)), 3700);
});

test("condensation releases 2n H2O per n repeating units; addition releases none", () => {
  assert.equal(waterReleased(polymerById("nylon66"), 500), 1000);
  assert.equal(waterReleased(polymerById("ps"), 500), 0);
});

test("quiz targets stay in range and are multiples of 100", () => {
  for (const r of [0, 0.5, 0.999999]) {
    const t = newTarget(() => r);
    assert.ok(t >= 500 && t <= 20000 && t % 100 === 0);
  }
  assert.equal(targetOf({ targetN: -5 }), 100);
  assert.equal(targetOf({ targetN: 1e12 }), 20000);
  assert.equal(targetOf({ targetN: "x" }), 100);
});

test("joining animation loops", () => {
  const s = initialState();
  for (let i = 0; i < 120 * 2; i++) step(s, 1 / 120);
  assert.ok(s.progress >= 0 && s.progress <= SHOW + 1.5);
});
