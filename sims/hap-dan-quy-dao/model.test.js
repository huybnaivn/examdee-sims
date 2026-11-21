import test from "node:test";
import assert from "node:assert/strict";
import { initialState, step, launch, elements, circularSpeed, G, STAR_RADIUS } from "./model.js";

const DT = 1 / 120;
const start = (starMass, distance, speed) => launch({ ...initialState(), starMass, distance, speed });
const rel = (a, b) => Math.abs(a - b) / Math.abs(b);

test("circular speed is √(G·M/r); Earth-like orbit is 2π AU/year", () => {
  assert.ok(rel(circularSpeed(1, 1), 2 * Math.PI) < 1e-12);
  assert.ok(rel(circularSpeed(2, 0.5), Math.sqrt((G * 2) / 0.5)) < 1e-12);
});

test("at the circular speed the radius stays constant", () => {
  for (const [M, r] of [[1, 1], [3, 0.5], [0.5, 2], [2, 1.3]]) {
    const s = start(M, r, circularSpeed(M, r));
    assert.ok(elements(s).ecc < 1e-12);
    const period = Math.sqrt(r ** 3 / M);
    for (let i = 0; i < Math.round((20 * period) / DT); i++) {
      step(s, DT);
      assert.ok(rel(Math.hypot(s.x, s.y), r) < 1e-4, `r drifted to ${Math.hypot(s.x, s.y)}`);
      assert.ok(rel(Math.hypot(s.vx, s.vy), circularSpeed(M, r)) < 1e-4);
    }
    assert.ok(s.orbits >= 19);
  }
});

test("energy and angular momentum are conserved over many elliptical orbits", () => {
  for (const [M, r, factor] of [[1, 1, 0.8], [1, 1, 1.2], [3, 0.5, 0.6], [0.5, 2, 1.3]]) {
    const s = start(M, r, factor * circularSpeed(M, r));
    const e0 = elements(s);
    for (let i = 0; i < Math.round((100 * e0.period) / DT); i++) {
      step(s, DT);
      if (i % 50) continue;
      const e = elements(s);
      assert.ok(rel(e.energy, e0.energy) < 1e-4, `energy ${e.energy} vs ${e0.energy}`);
      assert.ok(rel(e.momentum, e0.momentum) < 1e-10);
    }
    assert.ok(s.orbits >= 99);
    // no numerical precession to speak of: the orbit is still the same ellipse
    assert.ok(Math.abs(elements(s).ecc - e0.ecc) < 1e-4);
  }
});

test("period matches Kepler's third law, T² = 4π²·a³/(G·M)", () => {
  // circular: with G = 4π², T = √(r³/M) years
  for (const [M, r] of [[1, 1], [1, 2], [2, 1], [0.5, 0.5]]) {
    const s = start(M, r, circularSpeed(M, r));
    while (s.orbits < 2) step(s, DT);
    assert.ok(rel(s.measuredPeriod, Math.sqrt(r ** 3 / M)) < 1e-4);
  }
  // elliptical: a from the vis-viva equation, 1/a = 2/r − v²/(G·M)
  const ratios = [];
  for (const [M, r, factor] of [[1, 1, 0.8], [1, 1, 1.25], [2.5, 0.7, 0.7], [0.6, 1.5, 1.1]]) {
    const s = start(M, r, factor * circularSpeed(M, r));
    const a = 1 / (2 / r - s.speed ** 2 / (G * M));
    const expected = 2 * Math.PI * Math.sqrt(a ** 3 / (G * M));
    assert.ok(rel(elements(s).period, expected) < 1e-12);
    while (s.orbits < 2) step(s, DT);
    assert.ok(rel(s.measuredPeriod, expected) < 1e-4, `T = ${s.measuredPeriod}, expected ${expected}`);
    ratios.push((s.measuredPeriod ** 2 * M) / a ** 3);
  }
  for (const k of ratios) assert.ok(rel(k, 1) < 2e-4); // T²·M/a³ is the same for every orbit
});

test("orbit shape: closest and farthest distances match the ellipse", () => {
  const s = start(1, 1, 0.8 * circularSpeed(1, 1));
  const e0 = elements(s);
  assert.ok(rel(e0.apo, 1) < 1e-12); // launched slower than circular: launch point is the far end
  let min = Infinity;
  let max = 0;
  while (s.orbits < 1) {
    step(s, DT);
    min = Math.min(min, Math.hypot(s.x, s.y));
    max = Math.max(max, Math.hypot(s.x, s.y));
  }
  assert.ok(rel(min, e0.peri) < 1e-3);
  assert.ok(rel(max, e0.apo) < 1e-3);
});

test("above escape speed the orbit is open; with no speed the planet falls into the star", () => {
  const fast = start(1, 1, 1.5 * circularSpeed(1, 1));
  assert.equal(elements(fast).bound, false);
  for (let i = 0; i < 120 * 5; i++) step(fast, DT);
  assert.ok(Math.hypot(fast.x, fast.y) > 10);
  assert.equal(fast.orbits, 0);

  const still = start(1, 1, 0);
  for (let i = 0; i < 120; i++) step(still, DT);
  assert.equal(still.crashed, true);
  assert.ok(Math.hypot(still.x, still.y) <= STAR_RADIUS);
  const frozen = { ...still };
  step(still, DT);
  assert.deepEqual(still, frozen);
});
