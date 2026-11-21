import test from "node:test";
import assert from "node:assert/strict";
import { initialState, step, release, period, equilibrium, energy, AMPLITUDE_MAX } from "./model.js";

const run = (s, seconds, dt = 1 / 120) => {
  for (let i = 0; i < Math.round(seconds / dt); i++) step(s, dt);
  return s;
};
const make = (params, x = 0.1) => release({ ...initialState(), ...params }, x);

test("measured period matches 2π√(m/k)", () => {
  for (const [mass, k] of [[0.5, 20], [0.1, 100], [1, 10], [0.3, 47]]) {
    const s = make({ mass, k });
    const T = 2 * Math.PI * Math.sqrt(mass / k);
    assert.equal(period(s), T);
    run(s, 4.2 * T);
    assert.ok(Math.abs(s.measuredPeriod - T) / T < 1e-4, `${s.measuredPeriod} ≠ ${T}`);
  }
});

test("period does not depend on gravity or amplitude", () => {
  const T = period(initialState());
  for (const [gravity, x] of [[9.81, 0.02], [9.81, 0.2], [1.62, 0.1], [24.79, -0.15]]) {
    const s = run(make({ gravity }, x), 4.2 * T);
    assert.ok(Math.abs(s.measuredPeriod - T) / T < 1e-4);
  }
});

test("equilibrium stretch is m·g/k: no force there, and a damped mass settles there", () => {
  for (const [mass, k, gravity] of [[0.5, 20, 9.81], [1, 10, 9.81], [0.2, 50, 1.62]]) {
    const s = make({ mass, k, gravity }, 0);
    assert.equal(equilibrium(s), (mass * gravity) / k);
    run(s, 5);
    assert.ok(Math.abs(s.y - (mass * gravity) / k) < 1e-12 && Math.abs(s.v) < 1e-12);
    const damped = run(make({ mass, k, gravity, damping: 1 }, 0.2), 60);
    assert.ok(Math.abs(damped.y - (mass * gravity) / k) < 1e-6);
  }
});

test("the mass oscillates symmetrically about equilibrium with the release amplitude", () => {
  const s = make({}, 0.15);
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < 600; i++) {
    step(s, 1 / 120);
    lo = Math.min(lo, s.y - equilibrium(s));
    hi = Math.max(hi, s.y - equilibrium(s));
  }
  assert.ok(Math.abs(hi - 0.15) < 1e-3 && Math.abs(lo + 0.15) < 1e-3);
});

test("total energy is conserved without damping and lost with it", () => {
  for (const params of [{}, { mass: 0.1, k: 100 }, { mass: 1, k: 10, gravity: 24.79 }]) {
    const s = make(params, AMPLITUDE_MAX);
    const before = energy(s);
    assert.equal(before.kinetic, 0);
    assert.ok(Math.abs(before.gravitational) < 1e-12); // released from the reference level
    run(s, 60);
    assert.ok(Math.abs(energy(s).total - before.total) / before.total < 1e-4);
  }
  const s = make({ damping: 0.5 }, AMPLITUDE_MAX);
  const before = energy(s).total;
  run(s, 30);
  assert.ok(energy(s).total < before);
  assert.ok(energy(s).kinetic < 1e-9);
});
