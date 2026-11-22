import test from "node:test";
import assert from "node:assert/strict";
import { PLANETS, initialState, step, keplerPeriod, angularSpeed, angleAt, isInner, byDistance, compare, quizTap, tidy } from "./model.js";

test("periods follow Kepler's third law T² = a³ (years, AU) within 0,5 %", () => {
  for (const p of PLANETS) {
    assert.ok(Math.abs(keplerPeriod(p.a) - p.period) / p.period < 0.005, p.name);
  }
  assert.equal(keplerPeriod(1), 1);
  // documented periods in days for a few planets
  assert.ok(Math.abs(PLANETS[0].period * 365.25 - 88) < 0.5);
  assert.ok(Math.abs(PLANETS[3].period * 365.25 - 687) < 1);
});

test("planets are listed by distance and the period grows outwards", () => {
  assert.deepEqual(byDistance(), [0, 1, 2, 3, 4, 5, 6, 7]);
  for (let k = 1; k < PLANETS.length; k++) {
    assert.ok(PLANETS[k].a > PLANETS[k - 1].a);
    assert.ok(PLANETS[k].period > PLANETS[k - 1].period);
  }
  assert.equal(PLANETS[2].name, "Trái Đất");
});

test("four inner rocky planets, four outer gas planets; Jupiter is the largest", () => {
  assert.deepEqual(PLANETS.map(isInner), [true, true, true, true, false, false, false, false]);
  for (const p of PLANETS) assert.equal(p.type, isInner(p) ? "rock" : "gas");
  const largest = PLANETS.reduce((m, p) => (p.diameter > m.diameter ? p : m));
  assert.equal(largest.name, "Sao Mộc");
});

test("position after a given time follows the angular speed", () => {
  const earth = PLANETS[2];
  assert.equal(angularSpeed(earth), 360);
  const quarter = angleAt(earth, 0.25) - angleAt(earth, 0);
  assert.ok(Math.abs(quarter - Math.PI / 2) < 1e-12);
  for (const p of PLANETS) {
    const t = 3.7;
    const turned = ((angleAt(p, t) - angleAt(p, 0)) * 180) / Math.PI;
    assert.ok(Math.abs(turned - angularSpeed(p) * t) < 1e-9);
    // a full period brings the planet back to where it started
    const back = angleAt(p, p.period) - angleAt(p, 0);
    assert.ok(Math.abs(back - 2 * Math.PI) < 1e-12);
  }
  // step advances simulated time by dt · speed
  const s = initialState();
  for (let i = 0; i < 120; i++) step(s, 1 / 120);
  assert.ok(Math.abs(s.time - s.speed) < 1e-9);
});

test("comparison ratios, and they also obey Kepler's law", () => {
  const r = compare(4, 2); // Jupiter / Earth
  assert.ok(Math.abs(r.periodRatio - 11.86) < 1e-9);
  assert.ok(Math.abs(r.distanceRatio - 5.203) < 1e-9);
  for (const [i, j] of [[0, 7], [3, 5], [6, 1]]) {
    const c = compare(i, j);
    assert.ok(Math.abs(c.periodRatio / c.distanceRatio ** 1.5 - 1) < 0.01);
  }
});

test("quiz: only the next planet out counts; finishing returns done", () => {
  const s = initialState();
  assert.equal(quizTap(s, 4), "wrong");
  assert.equal(s.quizMistakes, 1);
  assert.equal(s.quizStep, 0);
  for (let k = 0; k < 7; k++) assert.equal(quizTap(s, k), "right");
  assert.equal(quizTap(s, 7), "done");
  assert.equal(s.quizStep, 8);
  assert.equal(quizTap(s, 0), "done");
  const forged = tidy({ ...initialState(), time: -5, quizStep: 99, quizMistakes: -3 });
  assert.deepEqual([forged.time, forged.quizStep, forged.quizMistakes], [0, 8, 0]);
});
