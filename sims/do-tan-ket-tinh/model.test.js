import { test } from "node:test";
import assert from "node:assert/strict";
import { TEMPS, SOLUTES, GAS, STATUS, initialState, solubility, gasSolubility, capacity, analyse, predictionOk } from "./model.js";

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);
const make = over => ({ ...initialState(), ...over });

test("each curve passes through its table points and is linear between them", () => {
  for (const [key, o] of Object.entries(SOLUTES)) {
    assert.equal(o.table.length, TEMPS.length);
    TEMPS.forEach((t, i) => near(solubility(key, t), o.table[i]));
    for (let i = 0; i < TEMPS.length - 1; i++) {
      near(solubility(key, TEMPS[i] + 5), (o.table[i] + o.table[i + 1]) / 2);
      near(solubility(key, TEMPS[i] + 2.5), o.table[i] + 0.25 * (o.table[i + 1] - o.table[i]));
    }
  }
  TEMPS.forEach((t, i) => near(gasSolubility(t), GAS.table[i]));
  near(gasSolubility(25), (4.34 + 3.59) / 2);
});

test("textbook values: KNO3 at 20 °C and 60 °C, NaCl at 25 °C", () => {
  near(solubility("KNO3", 20), 31.6);
  near(solubility("KNO3", 60), 110);
  near(solubility("NaCl", 25), 36.15);
});

test("temperature outside 0–100 °C is clamped, unknown solute falls back", () => {
  near(solubility("KNO3", -40), 13.3);
  near(solubility("KNO3", 500), 246);
  near(solubility("nope", 20), 31.6);
  assert.ok(Number.isFinite(solubility("KCl", NaN)));
});

test("solids dissolve better when hot; the gas dissolves worse", () => {
  for (const key of Object.keys(SOLUTES)) {
    for (let t = 0; t < 100; t += 1) assert.ok(solubility(key, t + 1) > solubility(key, t), `${key} at ${t}`);
  }
  for (let t = 0; t < 100; t += 1) assert.ok(gasSolubility(t + 1) < gasSolubility(t), `O2 at ${t}`);
  assert.ok(gasSolubility(100) >= 0);
});

test("NaCl changes little with temperature, KNO3 changes a lot", () => {
  const span = key => solubility(key, 100) - solubility(key, 0);
  assert.ok(span("NaCl") < 5);
  assert.ok(span("NaCl") / solubility("NaCl", 0) < 0.12);
  assert.ok(span("KNO3") > 200);
  assert.ok(span("KNO3") > 50 * span("NaCl"));
});

test("capacity scales with the mass of water", () => {
  near(capacity("KNO3", 100, 20), 31.6);
  near(capacity("KNO3", 200, 20), 63.2);
  near(capacity("KCl", 50, 40), 20);
});

test("cooling: crystallised = dissolved − S(t2)·m_water/100", () => {
  const a = analyse(make({ solute: "KNO3", water: 100, added: 100, t1: 60, t2: 20 }));
  near(a.dissolved1, 100);
  near(a.crystallised, 100 - 31.6);
  near(a.dissolved, 31.6);
  assert.equal(a.status, STATUS.saturated);
  // saturated at 60 °C in 200 g of water, cooled to 10 °C
  const b = analyse(make({ solute: "KNO3", water: 200, added: 220, t1: 60, t2: 10 }));
  near(b.dissolved1, 220);
  near(b.crystallised, 220 - 2 * 20.9);
  // for every solute, over a grid
  for (const solute of Object.keys(SOLUTES)) {
    for (const water of [50, 100, 150, 200]) {
      for (const added of [10, 60, 130, 250]) {
        for (const [t1, t2] of [[80, 20], [100, 0], [45, 35], [20, 20], [10, 70]]) {
          const r = analyse(make({ solute, water, added, t1, t2 }));
          const d1 = Math.min(added, capacity(solute, water, t1));
          near(r.dissolved1, d1);
          near(r.crystallised, Math.max(0, d1 - capacity(solute, water, t2)));
          near(r.dissolved + r.solid, added); // mass of solute is conserved
          assert.ok(r.crystallised >= 0 && r.solid >= 0 && r.dissolved >= 0);
          assert.ok(r.dissolved <= capacity(solute, water, t2) + 1e-9);
        }
      }
    }
  }
});

test("the excess that never dissolved at t1 is not counted as crystallised", () => {
  const a = analyse(make({ solute: "KCl", water: 100, added: 80, t1: 80, t2: 20 }));
  near(a.dissolved1, 51.1);
  near(a.undissolved1, 28.9);
  near(a.crystallised, 51.1 - 34);
  near(a.solid, 80 - 34);
});

test("NaCl gives almost no crystals on cooling, KNO3 gives many", () => {
  const nacl = analyse(make({ solute: "NaCl", added: 38, t1: 80, t2: 20 }));
  const kno3 = analyse(make({ solute: "KNO3", added: 160, t1: 80, t2: 20 }));
  near(nacl.crystallised, 2);
  near(kno3.crystallised, 128.4);
});

test("classification: unsaturated, saturated, supersaturated", () => {
  assert.equal(analyse(make({ added: 20, t1: 60, t2: 20 })).status, STATUS.unsaturated);
  assert.equal(analyse(make({ added: 31.6, t1: 60, t2: 20 })).status, STATUS.saturated);
  assert.equal(analyse(make({ added: 100, t1: 60, t2: 20 })).status, STATUS.saturated);
  // no seed crystal: everything stays dissolved above the curve
  const sup = analyse(make({ added: 100, t1: 60, t2: 20, seed: false }));
  assert.equal(sup.status, STATUS.supersaturated);
  near(sup.crystallised, 0);
  near(sup.dissolved, 100);
  assert.ok(sup.dissolved > sup.cap2);
  // undissolved solid left from t1 is a seed: no supersaturation possible
  const seeded = analyse(make({ added: 150, t1: 60, t2: 20, seed: false }));
  assert.equal(seeded.status, STATUS.saturated);
  near(seeded.crystallised, 110 - 31.6);
  // not below the curve: plain unsaturated even without seed
  assert.equal(analyse(make({ added: 20, t1: 60, t2: 20, seed: false })).status, STATUS.unsaturated);
});

test("heating instead of cooling crystallises nothing and may dissolve the rest", () => {
  const a = analyse(make({ solute: "KNO3", added: 100, t1: 20, t2: 60 }));
  near(a.dissolved1, 31.6);
  near(a.crystallised, 0);
  near(a.dissolved, 100);
  near(a.solid, 0);
});

test("forged state is clamped", () => {
  const a = analyse({ solute: "x", water: -5, added: 1e9, t1: 1e9, t2: -1e9, seed: true });
  assert.equal(a.key, "KNO3");
  assert.equal(a.water, 50);
  assert.equal(a.added, 250);
  for (const v of Object.values(a)) if (typeof v === "number") assert.ok(Number.isFinite(v) && v >= 0);
});

test("prediction tolerance: 1 g or 3 %", () => {
  assert.ok(predictionOk(68.4, 68.4));
  assert.ok(predictionOk(66.5, 68.4));
  assert.ok(!predictionOk(65, 68.4));
  assert.ok(predictionOk(2.9, 2));
  assert.ok(!predictionOk(3.5, 2));
  assert.ok(!predictionOk(0, 0)); // nothing crystallised: nothing to predict
});
