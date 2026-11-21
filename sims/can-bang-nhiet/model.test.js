import test from "node:test";
import assert from "node:assert/strict";
import { MATERIALS, EPS, initialState, heatCapacity, equilibrium, temperatures, current, heat, totalHeat, duration, start, separate, step } from "./model.js";

const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b)), `${a} ≉ ${b}`);
const make = over => ({ ...initialState(), ...over });
const CASES = [
  {},
  { m1: 0.2, t1: 100, mat1: "copper", m2: 0.5, t2: 25, mat2: "water" },
  { m1: 2, t1: 10, mat1: "water", m2: 3, t2: 90, mat2: "oil" }, // body 1 is the cold one
  { m1: 5, t1: 0, mat1: "lead", m2: 0.1, t2: 100, mat2: "iron" },
  { m1: 1, t1: 60, mat1: "water", m2: 1, t2: 60, mat2: "aluminium" }, // already equal
];
const run = s => {
  start(s);
  for (let i = 0; i < 120 * 30 && !s.done; i++) step(s, 1 / 120);
  assert.ok(s.done, "no equilibrium within 30 s");
  return s;
};

test("specific heats are the textbook values", () => {
  assert.deepEqual(MATERIALS, { water: 4200, aluminium: 880, copper: 380, iron: 460, lead: 130, oil: 2000 });
});

test("t = (m₁c₁t₁ + m₂c₂t₂)/(m₁c₁ + m₂c₂)", () => {
  // 0,5 kg of aluminium at 100 °C into 1 kg of water at 20 °C
  near(equilibrium(initialState()), (0.5 * 880 * 100 + 1 * 4200 * 20) / (0.5 * 880 + 1 * 4200));
  near(equilibrium(initialState()), 27.586206896551722);
  for (const c of CASES) {
    const s = make(c);
    const [c1, c2] = [s.m1 * MATERIALS[s.mat1], s.m2 * MATERIALS[s.mat2]];
    near(heatCapacity(s, 1), c1);
    near(equilibrium(s), (c1 * s.t1 + c2 * s.t2) / (c1 + c2));
    assert.ok(equilibrium(s) >= Math.min(s.t1, s.t2) - 1e-12 && equilibrium(s) <= Math.max(s.t1, s.t2) + 1e-12);
  }
});

test("equal masses of the same material end at the mean temperature", () => {
  for (const mat of Object.keys(MATERIALS)) {
    near(equilibrium(make({ m1: 1.5, mat1: mat, t1: 80, m2: 1.5, mat2: mat, t2: 30 })), 55);
  }
  near(equilibrium(make({ m1: 1, mat1: "water", t1: 100, m2: 3, mat2: "water", t2: 20 })), 40); // 1 : 3 by mass
});

test("Q_tỏa = Q_thu at every moment, and Q = m·c·Δt at the end", () => {
  for (const c of CASES) {
    const s = start(make(c));
    for (let i = 0; i < 120 * 30 && !s.done; i++) {
      step(s, 1 / 120);
      const q = heat(s);
      near(q.lost, q.gained, 1e-9);
      assert.ok(q.lost >= 0);
    }
    const q = heat(s);
    const teq = equilibrium(s);
    near(q.lost, heatCapacity(s, 1) * Math.abs(s.t1 - teq));
    near(q.gained, heatCapacity(s, 2) * Math.abs(s.t2 - teq));
    near(q.lost, totalHeat(s));
    assert.equal(q.hot, s.t1 >= s.t2 ? 1 : 2);
  }
  near(totalHeat(initialState()), 0.5 * 880 * (100 - 27.586206896551722)); // ≈ 31 862 J
});

test("the two temperatures approach the equilibrium monotonically and never cross it", () => {
  for (const c of CASES) {
    const s = start(make(c));
    const teq = equilibrium(s);
    let prev = current(s);
    assert.deepEqual(prev, { t1: s.t1, t2: s.t2 }); // starts from the initial temperatures
    for (let i = 0; i < 120 * 30 && !s.done; i++) {
      step(s, 1 / 120);
      const now = current(s);
      for (const k of ["t1", "t2"]) {
        assert.ok(Math.abs(now[k] - teq) <= Math.abs(prev[k] - teq) + 1e-12, "moved away from equilibrium");
        assert.ok((now[k] - teq) * (s[k] - teq) >= -1e-12, "overshot the equilibrium");
      }
      prev = now;
    }
    assert.ok(s.done);
    assert.deepEqual(current(s), { t1: teq, t2: teq });
  }
});

test("the run ends when the difference is under EPS, after the predicted time", () => {
  for (const c of CASES) {
    const s = run(make(c));
    const end = temperatures(s);
    assert.ok(Math.abs(end.t1 - end.t2) < EPS);
    assert.ok(Math.abs(s.time - duration(s)) <= 1 / 120 + 1e-9);
    assert.ok(!s.mixing);
  }
});

test("before contact and after separating nothing has been exchanged", () => {
  const s = initialState();
  assert.deepEqual(current(s), { t1: 100, t2: 20 });
  assert.deepEqual(heat(s), { lost: 0, gained: 0, hot: 1 });
  step(s, 1); // not mixing: time does not run
  assert.equal(s.time, 0);
  separate(run(s));
  assert.deepEqual(current(s), { t1: 100, t2: 20 });
  assert.equal(heat(s).lost, 0);
});
