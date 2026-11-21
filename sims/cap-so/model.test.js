import test from "node:test";
import assert from "node:assert/strict";
import { arithTerm, arithSum, geoTerm, geoSum, geoInfinite, terms, middle, summary, initialState } from "./model.js";

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${a} ≉ ${b}`);

test("arithmetic: uₙ = u₁ + (n − 1)d", () => {
  assert.deepEqual(terms("arith", 2, 3, 5), [2, 5, 8, 11, 14]);
  assert.equal(arithTerm(2, 3, 10), 29);
  assert.equal(arithTerm(5, -2, 4), -1);
  assert.equal(arithTerm(7, 0, 20), 7);
  close(arithTerm(-1.5, 0.5, 7), 1.5);
});

test("arithmetic: Sₙ = n(u₁ + uₙ)/2 agrees with adding the terms", () => {
  assert.equal(arithSum(1, 1, 100), 5050);
  assert.equal(arithSum(2, 3, 10), 155);
  for (const [u1, d, n] of [[2, 3, 10], [-4, 1.5, 13], [10, -5, 20], [0, 0, 1]]) {
    close(arithSum(u1, d, n), terms("arith", u1, d, n).reduce((x, y) => x + y, 0));
    close(arithSum(u1, d, n), (n * (2 * u1 + (n - 1) * d)) / 2); // the other textbook form
  }
});

test("geometric: uₙ = u₁·qⁿ⁻¹", () => {
  assert.deepEqual(terms("geo", 3, 2, 5), [3, 6, 12, 24, 48]);
  assert.equal(geoTerm(2, 3, 10), 2 * 3 ** 9);
  assert.equal(geoTerm(5, 1, 20), 5);
  assert.equal(geoTerm(4, 0, 1), 4); // q⁰ = 1
});

test("geometric: Sₙ = u₁(1 − qⁿ)/(1 − q), and Sₙ = n·u₁ when q = 1", () => {
  assert.equal(geoSum(1, 2, 10), 1023);
  assert.equal(geoSum(3, 1, 7), 21);
  assert.equal(geoSum(-2, 1, 20), -40);
  for (const [u1, q, n] of [[1, 2, 10], [3, -2, 7], [5, 0.5, 12], [-1, -0.3, 9], [2, 1.5, 20], [4, 0, 5]]) {
    close(geoSum(u1, q, n), terms("geo", u1, q, n).reduce((x, y) => x + y, 0));
  }
});

test("negative and fractional ratios", () => {
  assert.deepEqual(terms("geo", 1, -2, 5), [1, -2, 4, -8, 16]); // signs alternate
  assert.deepEqual(terms("geo", 8, 0.5, 4), [8, 4, 2, 1]);
  assert.deepEqual(terms("geo", 16, -0.5, 5), [16, -8, 4, -2, 1]);
  close(geoSum(16, -0.5, 5), 11);
  close(geoSum(1, -1, 4), 0);
  close(geoSum(1, -1, 5), 1);
});

test("infinite sum u₁/(1 − q) only when |q| < 1", () => {
  close(geoInfinite(1, 0.5), 2);
  close(geoInfinite(3, -0.5), 2);
  close(geoInfinite(9, 1 / 3), 13.5);
  assert.equal(geoInfinite(1, 1), null);
  assert.equal(geoInfinite(1, -1), null);
  assert.equal(geoInfinite(2, 1.5), null);
  assert.equal(geoInfinite(2, -3), null);
  // the partial sums approach it
  assert.ok(Math.abs(geoSum(1, 0.5, 20) - 2) < 1e-5);
  assert.equal(summary({ ...initialState(), kind: "arith" }).infinite, null);
});

test("middle-term properties", () => {
  for (const [u1, d, n] of [[2, 3, 9], [-5, 1.5, 4], [0, -2, 3]]) {
    const m = middle("arith", u1, d, n);
    close(m.left, m.right);
  }
  for (const [u1, q, n] of [[3, 2, 9], [1, -1.5, 6], [8, 0.5, 3], [-2, -0.3, 20]]) {
    const m = middle("geo", u1, q, n);
    close(m.left, m.right);
  }
  assert.equal(middle("arith", 1, 1, 10).k, 5);
  assert.equal(middle("geo", 1, 2, 2), null);
});

test("summary clamps forged state", () => {
  const r = summary({ kind: "x", u1: 1e9, d: NaN, q: -50, n: 999, overlay: true });
  assert.equal(r.kind, "geo");
  assert.equal(r.u1, 10);
  assert.equal(r.q, -3);
  assert.equal(r.n, 20);
  assert.ok(r.terms.every(Number.isFinite));
  const s = summary(initialState());
  close(s.un, 1.5 ** 9);
  close(s.sum, (1 - 1.5 ** 10) / (1 - 1.5));
  assert.deepEqual(s.other, terms("arith", 1, 2, 10));
});
