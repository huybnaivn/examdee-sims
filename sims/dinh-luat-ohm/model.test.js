import test from "node:test";
import assert from "node:assert/strict";
import { initialState, step, current, power, FLOW } from "./model.js";

const near = (a, b) => assert.ok(Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)), `${a} ≠ ${b}`);

test("I = U / R across the whole range of the controls", () => {
  for (let voltage = 0; voltage <= 12; voltage += 0.5) {
    for (let resistance = 5; resistance <= 50; resistance += 1) {
      const s = { ...initialState(), voltage, resistance };
      near(current(s), voltage / resistance);
      near(current(s) * resistance, voltage);
    }
  }
  near(current(initialState()), 0.6);
});

test("current is proportional to U and inversely proportional to R", () => {
  const base = { ...initialState(), voltage: 4, resistance: 20 };
  near(current({ ...base, voltage: 12 }), 3 * current(base));
  near(current({ ...base, resistance: 40 }), current(base) / 2);
});

test("P = U·I = U²/R = I²R", () => {
  for (const [voltage, resistance] of [[6, 10], [12, 5], [0, 30], [7.5, 47]]) {
    const s = { ...initialState(), voltage, resistance };
    near(power(s), voltage * current(s));
    near(power(s), voltage ** 2 / resistance);
    near(power(s), current(s) ** 2 * resistance);
  }
  near(power(initialState()), 3.6);
});

test("charges move at a speed proportional to the current, and stop at U = 0", () => {
  const slow = step({ ...initialState(), voltage: 2, resistance: 40 }, 0.1);
  const fast = step({ ...initialState(), voltage: 6, resistance: 40 }, 0.1);
  near(fast._phase, 3 * slow._phase);
  near(slow._phase, 0.05 * 0.1 * FLOW);
  assert.equal(step({ ...initialState(), voltage: 0 }, 0.1)._phase, 0);
  const s = initialState();
  for (let i = 0; i < 1000; i++) step(s, 1 / 120);
  assert.ok(s._phase >= 0 && s._phase < 1);
});
