import test from "node:test";
import assert from "node:assert/strict";
import { initialState, step, forces, theory, release } from "./model.js";

const DT = 1 / 120;
const rad = deg => (deg * Math.PI) / 180;
const close = (actual, expected, eps = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= eps * Math.max(1, Math.abs(expected)), `${actual} ≠ ${expected}`);
const runDown = s => {
  release(s);
  for (let i = 0; i < 1e6 && !s.done; i++) step(s, DT);
  return s;
};

test("N = m·g·cos α and Px = m·g·sin α", () => {
  for (const [angle, mass, gravity] of [[0, 5, 9.81], [30, 5, 9.81], [45, 2, 1.62], [60, 10, 10]]) {
    const f = forces({ ...initialState(), angle, mass, gravity });
    close(f.weight, mass * gravity);
    close(f.normal, mass * gravity * Math.cos(rad(angle)));
    close(f.along, mass * gravity * Math.sin(rad(angle)));
    close(Math.hypot(f.along, f.normal), f.weight);
  }
});

test("the block stays at rest iff tan α ≤ μn; static friction then balances Px", () => {
  for (let angle = 0; angle <= 60; angle += 1) {
    for (let muS = 0; muS <= 1; muS += 0.05) {
      const s = { ...initialState(), angle, muS, muK: Math.min(0.3, muS) };
      const rests = Math.tan(rad(angle)) <= muS;
      const f = forces(s);
      assert.equal(f.sliding, !rests);
      if (rests) {
        close(f.friction, f.along);
        assert.ok(f.friction <= f.maxStatic + 1e-12);
        assert.equal(f.accel, 0);
        runDown(s);
        assert.equal(s.pos, 0);
        assert.equal(s.v, 0);
        assert.equal(theory(s), null);
      } else {
        assert.ok(f.accel > 0);
      }
    }
  }
});

test("sliding: a = g(sin α − μt·cos α); at the bottom t = √(2s/a) and v = √(2·a·s)", () => {
  for (const [angle, muS, muK, gravity, length] of [[30, 0.4, 0.3, 9.81, 2], [45, 0.5, 0.5, 9.81, 5], [20, 0.1, 0.05, 1.62, 1], [60, 1, 0.8, 10, 3.5]]) {
    const s = { ...initialState(), angle, muS, muK, gravity, length };
    const a = gravity * (Math.sin(rad(angle)) - muK * Math.cos(rad(angle)));
    close(forces(s).accel, a);
    close(forces(s).friction, muK * forces(s).normal);
    close(theory(s).time, Math.sqrt((2 * length) / a));
    close(theory(s).speed, Math.sqrt(2 * a * length));
    runDown(s);
    assert.equal(s.pos, length);
    close(s.v, Math.sqrt(2 * a * length));
    close(s.time, Math.sqrt((2 * length) / a));
    close(forces(s).accel, a); // still the same while moving
  }
});

test("mid-run the motion follows v = a·t and s = a·t²/2", () => {
  const s = release({ ...initialState(), length: 5 });
  const a = forces(s).accel;
  for (let i = 0; i < 120; i++) step(s, DT);
  close(s.time, 1);
  close(s.v, a);
  close(s.pos, a / 2);
});

test("without friction a = g·sin α, whatever the mass", () => {
  const results = [0.5, 2, 10].map(mass => {
    const s = { ...initialState(), mass, muS: 0, muK: 0, angle: 25 };
    close(forces(s).accel, 9.81 * Math.sin(rad(25)));
    return runDown(s);
  });
  assert.equal(results[0].time, results[2].time);
  assert.equal(results[0].v, results[1].v);
});

test("kinetic friction never exceeds static friction", () => {
  const f = forces({ ...initialState(), angle: 30, muS: 0.4, muK: 0.9 });
  close(f.friction, 0.4 * f.normal);
  assert.ok(f.accel > 0);
});

test("a forged state cannot run away: out-of-range pos and v are clamped and the run ends", () => {
  const s = { ...initialState(), angle: 5, muS: 1, muK: 1, pos: -50, v: 3, released: true };
  for (let i = 0; i < 1e5 && !s.done; i++) step(s, DT);
  assert.ok(s.done && s.v === 0 && s.pos >= 0 && s.pos <= s.length);
  const up = { ...initialState(), v: -4, pos: 99, released: true };
  step(up, DT);
  assert.ok(up.pos <= up.length && up.v >= 0);
});
