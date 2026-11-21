import test from "node:test";
import assert from "node:assert/strict";
import { initialState, solve, brightness, wireCurrents, step } from "./model.js";

const near = (a, b) => assert.ok(Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)), `${a} ≠ ${b}`);
const cases = [
  { voltage: 12, r1: 10, r2: 20, r3: 30, useR3: true },
  { voltage: 12, r1: 10, r2: 20, r3: 30, useR3: false },
  { voltage: 24, r1: 5, r2: 5, r3: 50, useR3: true },
  { voltage: 4.5, r1: 47, r2: 8, r3: 13, useR3: true },
  { voltage: 0, r1: 10, r2: 20, r3: 30, useR3: true },
];
const resistors = c => [c.r1, c.r2, c.r3].slice(0, c.useR3 ? 3 : 2);

test("series: R = ΣRi, the same current everywhere, voltages add up to U", () => {
  for (const c of cases) {
    const s = { ...initialState(), ...c, mode: "series" };
    const out = solve(s);
    const sum = resistors(c).reduce((a, b) => a + b, 0);
    near(out.req, sum);
    near(out.total, c.voltage / sum);
    assert.equal(out.items.length, resistors(c).length);
    for (const it of out.items) {
      assert.equal(it.i, out.total);
      near(it.u, it.i * it.r);
    }
    near(out.items.reduce((a, it) => a + it.u, 0), c.voltage);
  }
  near(solve(initialState()).total, 0.2); // 12 V over 10 + 20 + 30 Ω
});

test("parallel: 1/R = Σ1/Ri, the same voltage on every branch, currents add up to I", () => {
  for (const c of cases) {
    const s = { ...initialState(), ...c, mode: "parallel" };
    const out = solve(s);
    near(1 / out.req, resistors(c).reduce((a, R) => a + 1 / R, 0));
    assert.ok(out.req < Math.min(...resistors(c)));
    for (const it of out.items) {
      near(it.u, c.voltage);
      near(it.i, c.voltage / it.r);
    }
    near(out.items.reduce((a, it) => a + it.i, 0), out.total);
    near(out.total, c.voltage / out.req);
  }
  const two = solve({ ...initialState(), mode: "parallel", useR3: false, r1: 20, r2: 20 });
  near(two.req, 10);
});

test("power: P = U·I = I²R per resistor, and the parts add up to the total", () => {
  for (const mode of ["series", "parallel"]) {
    for (const c of cases) {
      const out = solve({ ...initialState(), ...c, mode });
      for (const it of out.items) near(it.p, it.u * it.i);
      near(out.items.reduce((a, it) => a + it.p, 0), out.power);
      near(out.power, c.voltage * out.total);
    }
  }
});

test("an open switch in series stops all current", () => {
  for (const key of ["k1", "k2", "k3"]) {
    const out = solve({ ...initialState(), mode: "series", [key]: false });
    assert.equal(out.req, Infinity);
    assert.equal(out.total, 0);
    assert.equal(out.power, 0);
    for (const it of out.items) assert.deepEqual([it.i, it.u, it.p], [0, 0, 0]);
  }
  // the switch of an unused third resistor does not matter
  near(solve({ ...initialState(), mode: "series", useR3: false, k3: false }).total, 12 / 30);
});

test("an open switch in parallel stops only its own branch", () => {
  const all = solve({ ...initialState(), mode: "parallel" });
  const out = solve({ ...initialState(), mode: "parallel", k2: false });
  assert.deepEqual([out.items[1].i, out.items[1].u, out.items[1].p], [0, 0, 0]);
  assert.equal(out.items[0].i, all.items[0].i);
  assert.equal(out.items[2].i, all.items[2].i);
  near(out.total, 12 / 10 + 12 / 30);
  near(out.req, 1 / (1 / 10 + 1 / 30));
  const none = solve({ ...initialState(), mode: "parallel", k1: false, k2: false, k3: false });
  assert.equal(none.req, Infinity);
  assert.equal(none.total, 0);
});

test("brightness follows power", () => {
  assert.equal(brightness(0), 0);
  assert.ok(brightness(1) < brightness(2) && brightness(2) < brightness(4));
  assert.equal(brightness(1e6), 1);
  // series: the larger resistor is brighter; parallel: the smaller one
  const ser = solve(initialState()).items.map(it => brightness(it.p));
  const par = solve({ ...initialState(), mode: "parallel", voltage: 6 }).items.map(it => brightness(it.p));
  assert.ok(ser[0] < ser[1] && ser[1] < ser[2]);
  assert.ok(par[0] > par[1] && par[1] > par[2]);
});

test("wire currents obey the junction rule and drive the animation", () => {
  const s = { ...initialState(), mode: "parallel" };
  const out = solve(s);
  const w = wireCurrents(s);
  assert.equal(w.length, 6);
  near(w[0], out.total); // main line
  near(w[1], out.items[1].i + out.items[2].i);
  near(w[2], out.items[2].i);
  assert.deepEqual(w.slice(3), out.items.map(it => it.i));
  assert.deepEqual(wireCurrents(initialState()), [solve(initialState()).total]);
  step(s, 0.01);
  near(s._phase[3] / s._phase[5], out.items[0].i / out.items[2].i);
  s.mode = "series"; // changing the wiring must not leave a stale phase list behind
  step(s, 0.01);
  assert.equal(s._phase.length, 1);
  const open = step({ ...initialState(), k1: false }, 0.5);
  assert.deepEqual(open._phase, [0]);
});
