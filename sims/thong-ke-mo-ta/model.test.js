import test from "node:test";
import assert from "node:assert/strict";
import { MIN, MAX, CAP, PRESETS, initialState, stats, median, sanitize } from "./model.js";

const near = (x, y, eps = 1e-12) => assert.ok(Math.abs(x - y) < eps, `${x} ≠ ${y}`);

test("mean is the balance point: deviations on both sides cancel", () => {
  assert.equal(stats([2, 4, 9]).mean, 5);
  near(stats([1, 2, 2, 7]).mean, 3);
  for (const values of Object.values(PRESETS)) {
    const { mean } = stats(values);
    near(values.reduce((p, v) => p + (v - mean), 0), 0, 1e-9);
  }
});

test("median for odd and even counts, whatever the order of the input", () => {
  assert.equal(stats([7, 1, 3]).median, 3);
  assert.equal(stats([9, 1, 3, 7]).median, 5);
  assert.equal(stats([5, 3, 1, 2, 4, 6]).median, 3.5);
  assert.equal(stats([4]).median, 4);
  assert.equal(stats([2, 9]).median, 5.5);
  assert.equal(median([1, 2, 3, 4, 5]), 3);
  const input = [9, 1, 5];
  stats(input);
  assert.deepEqual(input, [9, 1, 5]); // the learner's order is not disturbed
});

test("mode: one, several, or none", () => {
  assert.deepEqual(stats([1, 2, 2, 3]).modes, [2]);
  assert.deepEqual(stats([5, 1, 1, 3, 5, 9]).modes, [1, 5]);
  assert.deepEqual(stats(PRESETS.bimodal).modes, [3, 9]);
  assert.deepEqual(stats([1, 2, 3, 4]).modes, []); // all different
  assert.deepEqual(stats([2, 2, 7, 7]).modes, []); // all equally frequent
  assert.deepEqual(stats(PRESETS.nomode).modes, []);
  assert.deepEqual(stats([6]).modes, [6]);
  assert.deepEqual(stats([6, 6, 6]).modes, [6]);
});

test("quartiles: medians of the two halves, leaving out the middle value when n is odd", () => {
  // n = 9 (odd): lower half 1 2 3 4, upper half 6 7 8 9
  let t = stats([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual([t.q1, t.median, t.q3, t.iqr], [2.5, 5, 7.5, 5]);
  // n = 8 (even): halves 1 2 3 4 and 5 6 7 8
  t = stats([1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual([t.q1, t.median, t.q3], [2.5, 4.5, 6.5]);
  // n = 7: halves 3 5 7 and 12 13 14  (textbook-style sample)
  t = stats([7, 3, 14, 10, 12, 5, 13]);
  assert.deepEqual([t.q1, t.median, t.q3], [5, 10, 13]);
  // n = 10: halves of five
  t = stats([2, 3, 3, 3, 5, 8, 9, 9, 9, 10]);
  assert.deepEqual([t.q1, t.median, t.q3], [3, 6.5, 9]);
  t = stats([4, 10]);
  assert.deepEqual([t.q1, t.median, t.q3], [4, 7, 10]);
  t = stats([1, 5, 6]);
  assert.deepEqual([t.q1, t.median, t.q3], [1, 5, 6]);
  for (const values of Object.values(PRESETS)) {
    const s = stats(values);
    assert.ok(s.min <= s.q1 && s.q1 <= s.median && s.median <= s.q3 && s.q3 <= s.max);
  }
});

test("range, population variance and standard deviation", () => {
  const t = stats([2, 4, 4, 4, 5, 5, 7, 9]); // mean 5, Σ(x − 5)² = 32
  assert.equal(t.mean, 5);
  assert.equal(t.variance, 4);
  assert.equal(t.sd, 2);
  assert.equal(t.range, 7);
  assert.equal(stats([3, 3, 3]).sd, 0);
  near(stats([0, 10]).sd, 5);
  // shifting every value leaves s unchanged
  near(stats([12, 14, 14, 14, 15, 15, 17, 19]).sd, 2);
});

test("an outlier pulls the mean but not the median", () => {
  const plain = stats(PRESETS.plain);
  const far = stats(PRESETS.outlier);
  assert.equal(plain.n, far.n);
  assert.equal(plain.mean, 6);
  assert.equal(plain.median, 6);
  assert.equal(far.median, 6);
  near(far.mean, 66 / 9);
  assert.ok(far.mean - plain.mean > 1);
  assert.deepEqual(far.modes, plain.modes);
  assert.ok(far.sd > 2 * plain.sd);
  assert.equal(far.q1, plain.q1);
});

test("empty and single-point samples never give NaN", () => {
  const empty = stats([]);
  assert.equal(empty.n, 0);
  assert.deepEqual(empty.modes, []);
  for (const key of ["mean", "median", "min", "max", "range", "q1", "q3", "iqr", "variance", "sd"]) assert.equal(empty[key], null);
  const one = stats([7]);
  assert.deepEqual([one.mean, one.median, one.min, one.max, one.range, one.variance, one.sd], [7, 7, 7, 7, 0, 0, 0]);
  assert.deepEqual([one.q1, one.q3, one.iqr], [null, null, null]);
  for (const t of [empty, one, stats([3, 3])]) {
    for (const v of Object.values(t).flat()) assert.ok(v === null || Number.isFinite(v));
  }
});

test("sanitize keeps only a valid list of points", () => {
  const base = initialState();
  const out = sanitize({ points: [3, "4", NaN, 7.6, -5, 99, null, Infinity], preset: 5, newValue: "x", showBox: false, evil: 1 }, base);
  assert.deepEqual(out, { points: [3, 8, MIN, MAX], preset: "custom", showBox: false });
  assert.deepEqual(sanitize({ points: PRESETS.plain, preset: "plain" }, base), { points: PRESETS.plain, preset: "plain" });
  assert.deepEqual(sanitize({ points: PRESETS.outlier }, base), { points: PRESETS.outlier });
  assert.equal(sanitize({ points: Array(50).fill(4) }, base).points.length, CAP);
  assert.deepEqual(sanitize({ points: "1,2,3", preset: "plain" }, base), { preset: "plain" });
  assert.deepEqual(sanitize({ points: [] }, base), { points: [], preset: "custom" });
  assert.deepEqual(sanitize({ newValue: NaN }, base), {});
});

test("initial state is the outlier preset, a fresh array each time", () => {
  const s = initialState();
  assert.deepEqual(s.points, PRESETS.outlier);
  s.points.push(1);
  assert.equal(initialState().points.length, PRESETS.outlier.length);
  for (const values of Object.values(PRESETS)) {
    assert.ok(values.length <= CAP && values.every(v => Number.isInteger(v) && v >= MIN && v <= MAX));
  }
});
