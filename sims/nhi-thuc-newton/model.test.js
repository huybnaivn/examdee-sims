import test from "node:test";
import assert from "node:assert/strict";
import { N_MAX, initialState, binom, pascalRow, pascal, terms, termWith, numericTerms, coefSum, alternatingSum, summary } from "./model.js";

const near = (x, y, eps = 1e-9) => assert.ok(Math.abs(x - y) <= eps * Math.max(1, Math.abs(y)), `${x} ≠ ${y}`);
const fact = n => (n <= 1 ? 1 : n * fact(n - 1));

test("coefficients are Cₙᵏ = n!/(k!(n − k)!)", () => {
  assert.deepEqual(pascalRow(3), [1, 3, 3, 1]);
  assert.deepEqual(pascalRow(4), [1, 4, 6, 4, 1]);
  assert.equal(binom(12, 6), 924);
  assert.equal(binom(10, 3), 120);
  assert.equal(binom(5, 7), 0);
  for (let n = 0; n <= N_MAX; n++)
    for (let k = 0; k <= n; k++) {
      assert.equal(binom(n, k), fact(n) / (fact(k) * fact(n - k)));
      assert.equal(binom(n, k), binom(n, n - k));
    }
});

test("sum of coefficients is 2ⁿ", () => {
  for (let n = 0; n <= N_MAX; n++) assert.equal(coefSum(n), 2 ** n);
});

test("Pascal's rule builds the same rows", () => {
  const rows = pascal(N_MAX);
  for (let n = 0; n <= N_MAX; n++) assert.deepEqual(rows[n], pascalRow(n));
  for (let n = 1; n <= N_MAX; n++) for (let k = 1; k < n; k++) assert.equal(binom(n, k), binom(n - 1, k - 1) + binom(n - 1, k));
});

test("the term containing a given power", () => {
  assert.deepEqual(termWith(5, 3, 2), { k: 2, coef: 10, aPow: 3, bPow: 2 }); // T₃ = 10a³b²
  assert.equal(termWith(12, 6, 6).coef, 924);
  assert.equal(termWith(4, 0, 4).coef, 1);
  assert.equal(termWith(4, 2, 1), null); // degrees must add up to n
  assert.equal(termWith(4, -1, 5), null);
  const t = terms(6);
  assert.equal(t.length, 7);
  for (const x of t) assert.equal(x.aPow + x.bPow, 6);
});

test("numeric expansion equals (a + b)ⁿ", () => {
  for (const [a, b] of [[2, 1], [1, 1], [3, -1], [-2.5, 0.5], [1.5, 2], [0, 3]])
    for (let n = 0; n <= N_MAX; n++) near(numericTerms(n, a, b).sum, (a + b) ** n);
  assert.deepEqual(numericTerms(3, 2, 1).values, [8, 12, 6, 1]);
});

test("alternating sum is 0 for n ≥ 1, 1 for n = 0", () => {
  assert.equal(alternatingSum(0), 1);
  for (let n = 1; n <= N_MAX; n++) assert.equal(alternatingSum(n), 0);
});

test("summary: answer, clamping of forged values", () => {
  const r = summary(initialState());
  assert.equal(r.n, 3);
  assert.equal(r.answer, 3);
  assert.equal(r.found, false);
  assert.ok(summary({ ...initialState(), pick: 2 }).found);
  const bad = summary({ n: 99, target: -4, pick: 50, a: NaN, b: "x" });
  assert.equal(bad.n, 12);
  assert.equal(bad.target, 0);
  assert.equal(bad.pick, 12);
  assert.equal(bad.power, 0);
});
