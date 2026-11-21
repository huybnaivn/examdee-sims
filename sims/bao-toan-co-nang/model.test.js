import test from "node:test";
import assert from "node:assert/strict";
import { initialState, step, release, energy, height, bottomSpeed } from "./model.js";

const DT = 1 / 120;
const start = (over = {}) => release({ ...initialState(), ...over });
const close = (a, b, rel) => Math.abs(a - b) <= rel * Math.max(Math.abs(a), Math.abs(b), 1e-12);

test("the initial state is the ball held at the release height, at rest", () => {
  const s = initialState();
  assert.equal(s.v, 0);
  assert.equal(s.time, 0);
  assert.ok(close(height(s.x), s.releaseHeight, 1e-12));
  assert.equal(energy(s).kinetic, 0);
});

test("without friction mechanical energy is conserved", () => {
  for (const over of [{}, { releaseHeight: 3.5, gravity: 24.79 }, { releaseHeight: 0.4, gravity: 1.62, mass: 5 }]) {
    const s = start(over);
    const e0 = energy(s).mechanical;
    assert.ok(close(e0, s.mass * s.gravity * s.releaseHeight, 1e-12));
    for (let i = 0; i < 120 * 60; i++) {
      step(s, DT);
      assert.ok(close(energy(s).mechanical, e0, 1e-4));
    }
    assert.equal(energy(s).thermal, 0);
  }
});

test("without friction the ball returns to its release height on both sides", () => {
  const s = start({ releaseHeight: 2.5 });
  const tops = [];
  let prev = s.v;
  for (let i = 0; i < 120 * 30; i++) {
    step(s, DT);
    if (prev !== 0 && Math.sign(s.v) !== Math.sign(prev)) tops.push(s.x);
    prev = s.v;
  }
  assert.ok(tops.length >= 6);
  assert.ok(tops.some(x => x > 0) && tops.some(x => x < 0));
  for (const x of tops) assert.ok(Math.abs(height(x) - 2.5) < 2e-3, `turned at h = ${height(x)}`);
});

test("speed at the bottom equals √(2·g·h)", () => {
  for (const [releaseHeight, gravity] of [[3, 9.81], [1, 9.81], [3.5, 1.62], [2, 24.79]]) {
    const s = start({ releaseHeight, gravity });
    let fastest = 0;
    let atBottom = 0;
    for (let i = 0; i < 120 * 20; i++) {
      const x0 = s.x;
      step(s, DT);
      fastest = Math.max(fastest, Math.abs(s.v));
      if (x0 < 0 && s.x >= 0) atBottom = Math.abs(s.v);
    }
    const expected = Math.sqrt(2 * gravity * releaseHeight);
    assert.ok(close(bottomSpeed(s), expected, 1e-12));
    assert.ok(close(fastest, expected, 1e-4));
    assert.ok(close(atBottom, expected, 2e-3)); // sampled within one step of x = 0
  }
});

test("the motion does not depend on mass", () => {
  const light = start({ mass: 0.5, friction: true });
  const heavy = start({ mass: 5, friction: true });
  for (let i = 0; i < 120 * 10; i++) {
    step(light, DT);
    step(heavy, DT);
  }
  assert.ok(Math.abs(light.x - heavy.x) < 1e-12);
  assert.ok(Math.abs(light.v - heavy.v) < 1e-12);
});

test("with friction mechanical energy decreases and mechanical + thermal stays constant", () => {
  for (const over of [{ mu: 0.1 }, { mu: 0.3, releaseHeight: 3.5 }, { mu: 0.02, gravity: 1.62, mass: 3 }]) {
    const s = start({ friction: true, ...over });
    const e0 = energy(s).total;
    let prev = energy(s).mechanical;
    for (let i = 0; i < 120 * 120; i++) {
      step(s, DT);
      const e = energy(s);
      assert.ok(e.mechanical <= prev + 1e-9 * e0, "mechanical energy never increases");
      assert.ok(close(e.total, e0, 1e-4), `total drifted to ${e.total} from ${e0}`);
      prev = e.mechanical;
    }
    assert.ok(energy(s).mechanical < 0.5 * e0);
  }
});

test("with friction the ball ends at rest where friction can hold it", () => {
  const s = start({ friction: true, mu: 0.2 });
  for (let i = 0; i < 120 * 120; i++) step(s, DT);
  const x = s.x;
  assert.equal(s.v, 0);
  assert.ok(Math.abs(2 * 0.25 * x) <= 0.2); // |slope| ≤ μ
  step(s, DT);
  assert.equal(s.x, x);
  const e = energy(s);
  assert.ok(close(e.thermal + e.potential, e.total, 1e-12));
});
