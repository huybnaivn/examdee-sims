import test from "node:test";
import assert from "node:assert/strict";
import { initialState, stages, at, step, restart, totalHeat, totalTime, C_ICE, C_WATER, C_STEAM, LAMBDA, L_VAP } from "./model.js";

const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} ≠ ${b}`);
const cases = [
  initialState(),
  { ...initialState(), mass: 2, tStart: -40, tEnd: 150, power: 5000 },
  { ...initialState(), mass: 0.1, tStart: -1, tEnd: 110, power: 500 },
];

test("single-phase stages: Q = m·c·Δt", () => {
  for (const s of cases) {
    const [ice, , water, , steam] = stages(s);
    near(ice.Q, s.mass * C_ICE * (0 - s.tStart));
    near(water.Q, s.mass * C_WATER * 100);
    near(steam.Q, s.mass * C_STEAM * (s.tEnd - 100));
  }
  // 0,5 kg of ice from −20 °C: 0,5 · 2100 · 20 = 21 000 J
  near(stages(initialState())[0].Q, 21000);
});

test("melting Q = λm and vaporisation Q = Lm", () => {
  for (const s of cases) {
    const list = stages(s);
    near(list[1].Q, LAMBDA * s.mass);
    near(list[3].Q, L_VAP * s.mass);
  }
  near(stages(initialState())[1].Q, 170000);
  near(stages(initialState())[3].Q, 1150000);
});

test("temperature stays constant during each phase change", () => {
  for (const s of cases) {
    const list = stages(s);
    for (const [k, T] of [[1, 0], [3, 100]]) {
      for (const f of [0.01, 0.25, 0.5, 0.75, 0.99]) {
        const c = at(s, list[k].start + f * list[k].duration);
        assert.equal(c.stage, k);
        near(c.temperature, T);
      }
    }
    // and changes linearly while one phase is heated
    const w = list[2];
    near(at(s, w.start + w.duration / 2).temperature, 50);
    near(at(s, list[0].start + list[0].duration / 2).temperature, s.tStart / 2);
  }
});

test("stage durations are Q/P and the total heat is the sum of the stages", () => {
  for (const s of cases) {
    const list = stages(s);
    let sum = 0;
    for (const st of list) {
      near(st.duration, st.Q / s.power);
      near(st.end - st.start, st.duration);
      sum += st.Q;
    }
    near(totalHeat(s), sum);
    near(totalTime(s), sum / s.power);
    near(totalHeat(s), s.mass * (C_ICE * -s.tStart + LAMBDA + C_WATER * 100 + L_VAP + C_STEAM * (s.tEnd - 100)));
  }
  near(totalHeat(initialState()), 21000 + 170000 + 210000 + 1150000 + 20000);
});

test("heat absorbed grows as P·t; phase fractions add up to 1 and are continuous", () => {
  const s = initialState();
  const end = totalTime(s);
  let prev = at(s, 0);
  assert.deepEqual([prev.solid, prev.liquid, prev.gas, prev.temperature], [1, 0, 0, -20]);
  for (let i = 1; i <= 2000; i++) {
    const c = at(s, (end * i) / 2000);
    near(c.heat, (s.power * end * i) / 2000);
    near(c.solid + c.liquid + c.gas, 1);
    assert.ok(Math.abs(c.temperature - prev.temperature) < 1, "temperature jumps");
    assert.ok(Math.abs(c.gas - prev.gas) < 0.01 && Math.abs(c.solid - prev.solid) < 0.01, "phase jumps");
    assert.ok(c.temperature >= prev.temperature - 1e-9, "temperature never falls");
    prev = c;
  }
  assert.equal(prev.stage, 5);
  assert.equal(prev.gas, 1);
  near(prev.temperature, s.tEnd);
  // forged times are clamped
  assert.equal(at(s, -50).temperature, -20);
  assert.equal(at(s, 1e9).gas, 1);
});

test("step reports every stage exactly once, in order, at the right time", () => {
  for (const s0 of cases) {
    const s = restart({ ...s0 });
    const list = stages(s);
    const seen = [];
    const dt = totalTime(s) / 997;
    for (let i = 0; i < 1200; i++) {
      for (const k of step(s, dt)) {
        seen.push(k);
        assert.ok(s.time >= list[k].end && s.time - list[k].end < dt + 1e-9);
      }
    }
    assert.deepEqual(seen, [0, 1, 2, 3, 4]);
    assert.equal(s.stagesDone, 5);
    near(s.time, totalTime(s));
  }
  // one huge step still reports all five
  assert.deepEqual(step(initialState(), 1e9), [0, 1, 2, 3, 4]);
  // a forged counter is tamed
  assert.deepEqual(step({ ...initialState(), stagesDone: -3 }, 0), []);
  assert.deepEqual(step({ ...initialState(), stagesDone: 99 }, 1e9), []);
});
