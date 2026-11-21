import test from "node:test";
import assert from "node:assert/strict";
import { SPECTRUM, initialState, indexOf, criticalAngle, trace, minDeviation, atMinDeviation } from "./model.js";

const rad = d => (d * Math.PI) / 180;
const sin = d => Math.sin(rad(d));
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);
const cases = [];
for (const A of [15, 30, 45, 60, 70]) for (const i of [0, 10, 35, 48.5, 60, 85]) for (const c of SPECTRUM) cases.push([A, i, c.n]);

test("dispersion table: seven colours, index rises from red to violet, crown-glass range", () => {
  assert.equal(SPECTRUM.length, 7);
  for (let k = 1; k < 7; k++) {
    assert.ok(SPECTRUM[k].n > SPECTRUM[k - 1].n);
    assert.ok(SPECTRUM[k].nm < SPECTRUM[k - 1].nm);
  }
  assert.ok(SPECTRUM[0].n > 1.51 && SPECTRUM[6].n < 1.54);
  assert.equal(indexOf("yellow"), 1.5167);
  assert.equal(indexOf(initialState().color), 1.5167);
});

test("Snell's law at both faces", () => {
  for (const [A, i, n] of cases) {
    const t = trace(A, i, n);
    close(sin(i), n * sin(t.r1));
    if (t.emerges) close(n * sin(t.r2), sin(t.i2));
  }
});

test("r1 + r2 = A and D = i1 + i2 − A", () => {
  for (const [A, i, n] of cases) {
    const t = trace(A, i, n);
    close(t.r1 + t.r2, A);
    if (t.emerges) close(t.deviation, i + t.i2 - A);
  }
});

test("known case: A = 60°, n = 1,5, i1 = 45°", () => {
  const t = trace(60, 45, 1.5);
  close(t.r1, 28.1255, 1e-3);
  close(t.r2, 31.8745, 1e-3);
  close(t.i2, 52.381, 1e-2);
  close(t.deviation, 37.381, 1e-2);
});

test("minimum deviation: i1 = i2, r1 = r2 = A/2, n = sin((D_min + A)/2)/sin(A/2)", () => {
  for (const A of [15, 30, 45, 60, 70])
    for (const { n } of SPECTRUM) {
      const m = minDeviation(A, n);
      const t = trace(A, m.incidence, n);
      close(t.i2, m.incidence, 1e-9);
      close(t.r1, A / 2);
      close(t.r2, A / 2);
      close(t.deviation, m.deviation);
      close(sin((m.deviation + A) / 2) / sin(A / 2), n);
      // it really is the minimum: every other incidence deviates more
      for (let i = 0; i <= 85; i += 0.5) {
        const other = trace(A, i, n);
        if (other.emerges) assert.ok(other.deviation >= m.deviation - 1e-9);
      }
    }
  close(minDeviation(60, 1.5).deviation, 37.18, 1e-2);
  assert.equal(minDeviation(120, 1.5), null);
});

test("goal tolerance: reachable on the 0,5° slider, not triggered away from the minimum", () => {
  for (const A of [15, 30, 45, 60, 70])
    for (const { n } of SPECTRUM) {
      const best = Math.round(minDeviation(A, n).incidence * 2) / 2;
      assert.ok(atMinDeviation(A, best, n));
      assert.ok(!atMinDeviation(A, best + 3, n));
      assert.ok(!atMinDeviation(A, Math.max(0, best - 3), n) || best < 3);
    }
  assert.equal(atMinDeviation(60, initialState().incidence, indexOf("yellow")), false);
  assert.equal(atMinDeviation(60, 20, 1.5167), false); // total reflection is never the goal
});

test("violet is deviated more than red (same prism, same incidence)", () => {
  for (const A of [15, 30, 45, 60, 70])
    for (const i of [20, 35, 50, 70, 85]) {
      const d = SPECTRUM.map(c => trace(A, i, c.n));
      if (!d[6].emerges) continue;
      for (let k = 1; k < 7; k++) assert.ok(d[k].deviation > d[k - 1].deviation, `A=${A} i=${i}`);
    }
});

test("total internal reflection: no emergent ray once r2 passes the critical angle", () => {
  close(criticalAngle(1.5), 41.8103, 1e-3);
  for (const [A, i, n] of cases) {
    const t = trace(A, i, n);
    assert.equal(t.emerges, t.r2 <= criticalAngle(n) + 1e-9, `A=${A} i=${i} n=${n}`);
    if (!t.emerges) {
      assert.equal(t.i2, null);
      assert.equal(t.deviation, null);
    }
  }
  assert.equal(trace(60, 20, 1.5167).emerges, false);
  assert.equal(trace(60, 35, 1.5167).emerges, true);
  // near the limit violet (larger n, smaller critical angle) is lost before red
  const edge = [27.5, 28, 28.5, 29].map(i => [trace(60, i, 1.5143).emerges, trace(60, i, 1.5302).emerges]);
  assert.ok(edge.some(([red, violet]) => red && !violet));
  assert.ok(!edge.some(([red, violet]) => !red && violet));
});
