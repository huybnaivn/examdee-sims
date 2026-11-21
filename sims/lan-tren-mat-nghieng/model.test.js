import test from "node:test";
import assert from "node:assert/strict";
import { initialState, BODIES, G, accel, finishTime, distance, speed, turned, energy, ranking, step, lastFinish } from "./model.js";

const close = (a, b, rel = 1e-9) => assert.ok(Math.abs(a - b) <= rel * Math.max(1, Math.abs(b)), `${a} ≠ ${b}`);
const at = (patch, time) => ({ ...initialState(), ...patch, time });

test("a = g·sin α / (1 + I/(mR²)) with I/(mR²) = 0, 2/5, 1/2, 1", () => {
  const s = at({ angle: 30 }, 0);
  const want = { block: G / 2, sphere: G / 2 / 1.4, cylinder: G / 2 / 1.5, ring: G / 2 / 2 };
  for (const b of BODIES) close(accel(s, b.k), want[b.id]);
  assert.deepEqual(BODIES.map(b => b.k), [0, 0.4, 0.5, 1]);
});

test("finish order: block, then sphere, cylinder, ring, and t = √(2L/a)", () => {
  for (const angle of [5, 20, 45]) {
    for (const length of [0.5, 3]) {
      const s = at({ angle, length }, 0);
      assert.deepEqual(ranking(s).map(b => b.id), ["block", "sphere", "cylinder", "ring"]);
      for (const b of BODIES) close(finishTime(s, b.k), Math.sqrt((2 * length) / accel(s, b.k)));
    }
  }
});

test("mass and radius do not change the times", () => {
  const base = at({}, 0);
  for (const [mass, radius] of [[0.2, 0.03], [10, 0.3]]) {
    const s = at({ mass, radius }, 0);
    for (const b of BODIES) assert.equal(finishTime(s, b.k), finishTime(base, b.k));
  }
});

test("mgh = ½mv² + ½Iω² with v = ωR, at every moment and at the finish", () => {
  for (const b of BODIES) {
    for (const time of [0, 0.3, 0.7, 5]) {
      const s = at({ angle: 25, length: 3, mass: 2.5, radius: 0.15 }, time);
      const e = energy(s, b.k);
      const top = s.mass * G * s.length * Math.sin((25 * Math.PI) / 180);
      close(e.total, top);
      // rolling share of the kinetic energy is k/(1+k), independent of time
      if (time > 0) close(e.rotational / (e.translational + e.rotational), b.k / (1 + b.k));
      // ω from the turned angle agrees with v/R (rolling without slipping)
      if (b.k && time < finishTime(s, b.k)) close(turned(s, b.k), distance(s, b.k) / s.radius);
    }
  }
});

test("v = √(2gh/(1+k)) at the bottom", () => {
  const s = at({ angle: 40, length: 2 }, 10);
  const h = 2 * Math.sin((40 * Math.PI) / 180);
  for (const b of BODIES) close(speed(s, b.k), Math.sqrt((2 * G * h) / (1 + b.k)));
});

test("step stops at the last finish and marks done; forged time is clamped", () => {
  const s = initialState();
  while (!s.done) step(s, 1 / 120);
  close(s.time, lastFinish(s));
  for (const b of BODIES) close(distance(s, b.k), s.length);
  const forged = at({}, -50);
  assert.equal(distance(forged, 0), 0);
  assert.equal(energy(at({}, 1e9), 1).total, energy(at({}, 100), 1).total);
});
