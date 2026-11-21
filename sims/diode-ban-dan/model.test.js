import test from "node:test";
import assert from "node:assert/strict";
import { initialState, DIODES, I_REF, current, operatingPoint, rectified, conducting, averageOutput, source, step } from "./model.js";

const si = DIODES.si;
const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} ≠ ${b}`);

test("silicon: forward current grows steeply above 0,6–0,7 V", () => {
  assert.ok(current(si, 0.5) < 1e-4); // below 0,1 mA
  assert.ok(current(si, 0.6) > 1e-4 && current(si, 0.6) < 1e-3);
  near(current(si, 0.7), I_REF);
  // every +60 mV multiplies the current by about ten (n·VT·ln 10 ≈ 60 mV)
  near(current(si, 0.76) / current(si, 0.7), Math.exp(0.06 / 0.026), 1e-6);
  assert.ok(current(si, 0.8) > 0.4);
});

test("reverse current is negligible and never exceeds the saturation current", () => {
  for (const d of Object.values(DIODES)) {
    for (const u of [-0.5, -5, -20]) {
      const i = current(d, u);
      assert.ok(i < 0 && Math.abs(i) < 1e-6, `${d.name} ${u} V: ${i}`);
    }
  }
  const op = operatingPoint({ ...initialState(), emf: -10 });
  assert.equal(op.conducting, false);
  near(op.u, -10, 1e-6); // the whole source voltage lies across the blocked diode
});

test("DC circuit: E = U_D + R·I, conducting when forward biased above the threshold", () => {
  for (const [emf, resistance] of [[2, 100], [5, 470], [10, 50], [0.4, 100], [-3, 100]]) {
    const op = operatingPoint({ ...initialState(), emf, resistance });
    near(op.u + resistance * op.i, emf, 1e-9);
  }
  const on = operatingPoint({ ...initialState(), emf: 5, resistance: 100 });
  assert.ok(on.conducting && on.u > 0.6 && on.u < 0.8);
  assert.equal(operatingPoint({ ...initialState(), emf: 0.4 }).conducting, false);
});

test("LED colours have higher thresholds, rising from red to blue", () => {
  const order = ["ge", "si", "red", "yellow", "green", "blue"].map(k => DIODES[k].uth);
  for (let k = 1; k < order.length; k++) assert.ok(order[k] > order[k - 1]);
  for (const key of ["red", "yellow", "green", "blue", "white"]) {
    const d = DIODES[key];
    assert.ok(d.uth >= 1.6);
    near(current(d, d.uth), I_REF);
    // at the silicon threshold an LED is still off
    assert.ok(current(d, 0.7) < 1e-9);
  }
  // at E = 2 V through 100 Ω a red LED lights, a blue one does not
  assert.ok(operatingPoint({ ...initialState(), diode: "red", emf: 2.5 }).conducting);
  assert.equal(operatingPoint({ ...initialState(), diode: "blue", emf: 2.5 }).conducting, false);
});

test("half-wave: output is zero for the whole negative half-cycle", () => {
  const s = { ...initialState(), rectifier: "half" };
  for (let k = 1; k < 100; k++) {
    const x = 0.5 + k / 200; // second half of the period
    assert.ok(source(s, x) < 0);
    assert.equal(rectified(s, source(s, x)), 0);
    assert.deepEqual(conducting(s, source(s, x)), [false]);
  }
  near(rectified(s, 10), 10 - si.uth);
  // ideal diode (no drop): average = U0/π
  const ideal = { ...s, diode: "ideal" };
  DIODES.ideal = { uth: 0, n: 1 };
  near(averageOutput(ideal), 10 / Math.PI, 1e-5);
  delete DIODES.ideal;
});

test("full-wave bridge: output = |u| − 2·U_ng, two diodes conduct in each half-cycle", () => {
  const s = { ...initialState(), rectifier: "full" };
  for (const u of [10, 5, 1.5, -1.5, -5, -10]) near(rectified(s, u), Math.abs(u) - 2 * si.uth);
  assert.equal(rectified(s, 1.2), 0); // below two drops nothing gets through
  assert.deepEqual(conducting(s, 5), [true, false, false, true]);
  assert.deepEqual(conducting(s, -5), [false, true, true, false]);
  DIODES.ideal = { uth: 0, n: 1 };
  near(averageOutput({ ...s, diode: "ideal" }), (2 * 10) / Math.PI, 1e-5);
  delete DIODES.ideal;
  // full-wave delivers about twice the half-wave average
  const half = averageOutput({ ...s, rectifier: "half", amplitude: 20 });
  const full = averageOutput({ ...s, amplitude: 20 });
  assert.ok(full > 1.8 * half && full < 2 * half);
});

test("the AC phase advances and wraps, DC mode stays still", () => {
  const s = { ...initialState(), mode: "ac", phase: 0.99 };
  step(s, 0.1);
  assert.ok(s.phase >= 0 && s.phase < 0.1);
  const d = { ...initialState(), phase: 0.3 };
  step(d, 0.1);
  assert.equal(d.phase, 0.3);
});
