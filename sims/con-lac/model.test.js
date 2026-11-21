import test from "node:test";
import assert from "node:assert/strict";
import { initialState, step, smallAnglePeriod, energy, release } from "./model.js";

const run = (s, seconds, dt = 1 / 120) => {
  for (let i = 0; i < Math.round(seconds / dt); i++) step(s, dt);
  return s;
};

test("measured period matches 2π√(l/g) at small angles", () => {
  for (const [length, gravity] of [[1, 9.81], [0.5, 9.81], [2, 1.62]]) {
    const s = release({ ...initialState(), length, gravity }, 0.05);
    run(s, 4 * smallAnglePeriod(s));
    assert.ok(Math.abs(s.measuredPeriod - smallAnglePeriod(s)) / smallAnglePeriod(s) < 0.005);
  }
});

test("period does not depend on mass, and grows with amplitude", () => {
  const light = run(release({ ...initialState(), mass: 0.2 }, 0.3), 10);
  const heavy = run(release({ ...initialState(), mass: 5 }, 0.3), 10);
  assert.equal(light.measuredPeriod, heavy.measuredPeriod);
  const wide = run(release(initialState(), 1.4), 10);
  assert.ok(wide.measuredPeriod > light.measuredPeriod * 1.05);
});

test("energy is conserved without damping and lost with it", () => {
  const s = release(initialState(), 1);
  const before = energy(s).total;
  run(s, 60);
  assert.ok(Math.abs(energy(s).total - before) / before < 1e-4);
  const damped = release({ ...initialState(), damping: 0.3 }, 1);
  run(damped, 20);
  assert.ok(energy(damped).total < before * 0.05);
});
