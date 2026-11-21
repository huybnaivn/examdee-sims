import test from "node:test";
import assert from "node:assert/strict";
import { initialState, step, forces, G } from "./model.js";

const DT = 1 / 120;
const run = (s, seconds) => {
  for (let i = 0; i < Math.round(seconds / DT); i++) step(s, DT);
  return s;
};
const close = (actual, expected, eps = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= eps * Math.max(1, Math.abs(expected)), `${actual} ≠ ${expected}`);

test("sliding: a = (F − μk·m·g)/m, v = a·t, x = a·t²/2", () => {
  for (const [force, mass, muS, muK] of [[30, 5, 0.4, 0.3], [100, 20, 0.3, 0.1], [12, 1, 1, 1], [-60, 8, 0.5, 0.25]]) {
    const s = { ...initialState(), force, mass, muS, muK };
    const a = (Math.abs(force) - muK * mass * G) / mass;
    close(forces(s).accel, Math.sign(force) * a);
    run(s, 3);
    close(forces(s).accel, Math.sign(force) * a);
    close(s.v, Math.sign(force) * a * 3);
    close(s.x, (Math.sign(force) * a * 9) / 2);
  }
});

test("block stays at rest up to the static threshold μs·m·g, friction balances the force", () => {
  const limit = 0.4 * 5 * G; // 19,62 N
  for (const force of [0, 5, -12, 19.6, limit]) {
    const s = { ...initialState(), force };
    const f = forces(s);
    assert.equal(f.sliding, false);
    close(f.friction, -force);
    assert.equal(f.net, 0);
    run(s, 5);
    assert.equal(s.v, 0);
    assert.equal(s.x, 0);
  }
  const s = run({ ...initialState(), force: limit + 0.01 }, 1);
  assert.ok(forces(s).sliding && s.v > 0 && s.x > 0);
  close(forces(s).friction, -0.3 * 5 * G);
});

test("without friction v grows linearly: v = (F/m)·t", () => {
  const s = { ...initialState(), force: 10, mass: 4, muS: 0, muK: 0 };
  for (let t = 1; t <= 5; t++) {
    run(s, 1);
    close(s.v, 2.5 * t);
  }
  close(s.x, (2.5 * 25) / 2);
});

test("when the force is removed friction stops the block and it stays stopped", () => {
  const s = run({ ...initialState() }, 2); // a = 3,057 m/s²
  const v = s.v;
  const x = s.x;
  s.force = 0;
  const decel = 0.3 * G;
  run(s, v / decel + 1);
  assert.equal(s.v, 0);
  close(s.x, x + (v * v) / (2 * decel), 1e-9);
  assert.equal(forces(s).net, 0);
});

test("kinetic friction never exceeds static friction, so a block at rest is never pushed backwards", () => {
  const s = { ...initialState(), force: 25, muS: 0.4, muK: 0.9 };
  const f = forces(s);
  assert.ok(f.accel > 0);
  close(f.friction, -0.4 * 5 * G);
});
