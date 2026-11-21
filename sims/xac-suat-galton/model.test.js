import test from "node:test";
import assert from "node:assert/strict";
import { initialState, random, dropBall, clear, step, busy, choose, binomial, theory, stats, sanitize, MAX_ROWS, RELEASE, ROW_TIME } from "./model.js";

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);
const fresh = (rows, p, seed = 1) => {
  const s = { ...initialState(), rows, p, seed };
  clear(s);
  return s;
};
const drop = (s, n) => {
  for (let i = 0; i < n; i++) dropBall(s);
  return s;
};

test("binomial probabilities match C(n,k)·p^k·(1−p)^(n−k) and sum to 1", () => {
  assert.equal(choose(8, 4), 70);
  assert.equal(choose(12, 6), 924);
  assert.equal(choose(5, 0), 1);
  near(binomial(8, 4, 0.5), 70 / 256);
  near(binomial(3, 2, 0.3), 3 * 0.09 * 0.7);
  near(binomial(4, 0, 0.25), 0.75 ** 4);
  const fact = n => (n <= 1 ? 1 : n * fact(n - 1));
  for (let n = 1; n <= MAX_ROWS; n++) {
    for (const p of [0, 0.05, 0.3, 0.5, 0.85, 1]) {
      let sum = 0;
      for (let k = 0; k <= n; k++) {
        near(binomial(n, k, p), (fact(n) / fact(k) / fact(n - k)) * p ** k * (1 - p) ** (n - k), 1e-12);
        sum += binomial(n, k, p);
      }
      near(sum, 1, 1e-12);
    }
  }
});

test("the distribution has mean np and variance np(1−p)", () => {
  for (let n = 1; n <= MAX_ROWS; n++) {
    for (const p of [0, 0.2, 0.5, 0.75, 1]) {
      let mean = 0;
      for (let k = 0; k <= n; k++) mean += k * binomial(n, k, p);
      let variance = 0;
      for (let k = 0; k <= n; k++) variance += (k - mean) ** 2 * binomial(n, k, p);
      near(mean, n * p, 1e-10);
      near(variance, n * p * (1 - p), 1e-10);
      near(theory(n, p).mean, n * p);
      near(theory(n, p).sd ** 2, n * p * (1 - p));
    }
  }
});

test("sample statistics: mean and standard deviation (dividing by N)", () => {
  const r = stats([1, 0, 2, 1]); // values 0, 2, 2, 3
  assert.equal(r.n, 4);
  near(r.mean, 1.75);
  near(r.sd, Math.sqrt((1.75 ** 2 + 2 * 0.25 ** 2 + 1.25 ** 2) / 4));
  assert.deepEqual(stats([0, 0, 0]), { n: 0, mean: 0, sd: 0 });
});

test("the seeded generator is deterministic and uniform enough", () => {
  const a = { seed: 42 };
  const b = { seed: 42 };
  const c = { seed: 43 };
  const xs = Array.from({ length: 1000 }, () => random(a));
  assert.deepEqual(xs, Array.from({ length: 1000 }, () => random(b)));
  assert.notDeepEqual(xs, Array.from({ length: 1000 }, () => random(c)));
  assert.ok(xs.every(x => x >= 0 && x < 1));
  near(xs.reduce((s, x) => s + x, 0) / 1000, 0.5, 0.03);
  assert.ok(Number.isInteger(a.seed) && a.seed >= 0 && a.seed <= 0xffffffff);
});

test("a saved state replays identically", () => {
  assert.deepEqual(initialState(), initialState());
  const s = drop(fresh(10, 0.35, 7), 37);
  const saved = sanitize(JSON.parse(JSON.stringify(s)), initialState());
  drop(s, 500);
  drop(saved, 500);
  assert.deepEqual(saved.bins, s.bins);
  assert.equal(saved.seed, s.seed);
  // the animated route drops the same balls as dropping them directly
  const anim = fresh(10, 0.35, 7);
  anim.pending = 37;
  while (busy(anim)) step(anim, 1 / 120);
  assert.deepEqual(anim.bins, drop(fresh(10, 0.35, 7), 37).bins);
});

test("with p = 0 or p = 1 every ball lands in the end bin", () => {
  for (const rows of [1, 5, MAX_ROWS]) {
    const left = drop(fresh(rows, 0), 300);
    assert.equal(left.bins[0], 300);
    const right = drop(fresh(rows, 1), 300);
    assert.equal(right.bins[rows], 300);
    assert.deepEqual([stats(right.bins).mean, stats(right.bins).sd], [rows, 0]);
  }
});

test("a large sample is close to the theory", () => {
  for (const [rows, p] of [[8, 0.5], [12, 0.3], [5, 0.8]]) {
    const N = 40000;
    const s = drop(fresh(rows, p, 123), N);
    assert.equal(stats(s.bins).n, N);
    for (let k = 0; k <= rows; k++) near(s.bins[k] / N, binomial(rows, k, p), 0.01);
    near(stats(s.bins).mean, theory(rows, p).mean, 0.03);
    near(stats(s.bins).sd, theory(rows, p).sd, 0.03);
  }
});

test("step releases a batch at a steady rate, then goes idle; clear empties the board", () => {
  const s = fresh(6, 0.5);
  assert.equal(busy(s), false);
  s.pending = 10;
  step(s, 1 / 120);
  assert.equal(stats(s.bins).n, 1, "the first ball leaves at once");
  let t = 1 / 120;
  while (busy(s)) {
    step(s, 1 / 120);
    t += 1 / 120;
  }
  assert.equal(stats(s.bins).n, 10);
  assert.equal(s.pending, 0);
  near(t, 9 * RELEASE + 7 * ROW_TIME, 0.05);
  s.continuous = true;
  for (let i = 0; i < 120; i++) step(s, 1 / 120);
  near(stats(s.bins).n, 10 + 1 / RELEASE, 2);
  s.continuous = false;
  s.pending = 5;
  clear(s);
  assert.deepEqual([stats(s.bins).n, s.bins.length, busy(s)], [0, 7, false]);
});

test("sanitize rejects malformed saved states", () => {
  const base = initialState();
  const bad = sanitize({ rows: 99, p: -3, seed: "x", bins: [1, 2], pending: 1e9, continuous: "yes" }, base);
  assert.equal(bad.rows, MAX_ROWS);
  assert.equal(bad.p, 0);
  assert.equal(bad.seed, base.seed);
  assert.deepEqual(bad.bins, Array(MAX_ROWS + 1).fill(0));
  assert.equal(bad.pending, 1000);
  assert.equal(bad.continuous, false);
  assert.deepEqual(sanitize({ rows: 2, bins: [1, -1, 0] }, base).bins, [0, 0, 0]);
  assert.deepEqual(sanitize({ rows: 2, bins: [1, 5, 0] }, base).bins, [1, 5, 0]);
  assert.deepEqual(sanitize(JSON.parse(JSON.stringify(base)), base), base);
});
