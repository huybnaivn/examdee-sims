import test from "node:test";
import assert from "node:assert/strict";
import { initialState, sqrtReal, isqrt, isPerfectSquare, bracket, setArea, tryX, midpoint, trapped, range, bisect, squareFree, simplify, area, radicand } from "./model.js";

test("perfect squares have a whole side; others lie between two whole numbers", () => {
  for (let k = 0; k <= 14; k++) {
    assert.ok(isPerfectSquare(k * k));
    assert.equal(isqrt(k * k), k);
    assert.deepEqual(bracket(k * k), [k, k]);
  }
  for (const n of [2, 3, 5, 8, 10, 15, 50, 99, 199]) {
    assert.ok(!isPerfectSquare(n));
    const [a, b] = bracket(n);
    assert.equal(b, a + 1);
    assert.ok(a * a < n && n < b * b);
  }
  const s = { ...initialState(), n: 49 };
  setArea(s);
  assert.deepEqual(range(s), [7, 7]);
  assert.equal(trapped(s), false); // nothing to squeeze
});

test("bisection converges to Math.sqrt", () => {
  for (const n of [2, 3, 7, 10, 55, 200]) {
    const [lo, hi] = bisect(n, 40);
    assert.ok(lo * lo <= n && hi * hi > n);
    assert.ok(Math.abs(lo - Math.sqrt(n)) < 1e-9);
    // every halving halves the width
    const [l5, h5] = bisect(n, 5);
    assert.equal(h5 - l5, 1 / 32);
  }
});

test("the two-decimal squeeze traps √n: lo ≤ √n < lo + 0,01", () => {
  for (let n = 0; n <= 200; n++) {
    const s = { ...initialState(), n };
    setArea(s);
    if (isPerfectSquare(n)) continue;
    let steps = 0;
    while (!trapped(s)) {
      assert.ok(tryX(s, midpoint(s)));
      steps++;
    }
    assert.ok(steps <= 7); // 100 hundredths, halved each time
    const [lo, hi] = range(s);
    assert.ok(lo <= Math.sqrt(n) && Math.sqrt(n) < hi);
    assert.equal(lo, Math.floor(Math.sqrt(n) * 100) / 100);
  }
  // √2: 1,41² = 1,9881 ≤ 2 < 1,42² = 2,0164
  const s = { ...initialState(), n: 2 };
  setArea(s);
  assert.ok(tryX(s, 1.41) && tryX(s, 1.42));
  assert.ok(trapped(s));
  assert.deepEqual(range(s), [1.41, 1.42]);
  assert.equal(tryX(s, 1.5), false); // outside the squeeze: no change
  assert.deepEqual(range(s), [1.41, 1.42]);
});

test("a forged squeeze falls back to the whole-number bracket", () => {
  assert.deepEqual(range({ n: 10, lo: 3.5, hi: 4 }), [3, 4]); // 3,5² > 10
  assert.deepEqual(range({ n: 10, lo: 3, hi: 3.1 }), [3, 4]); // 3,1² < 10
  assert.deepEqual(range({ n: 10, lo: 3.16, hi: 3.17 }), [3.16, 3.17]);
  assert.equal(area({ n: -5 }), 0);
  assert.equal(area({ n: 1e9 }), 200);
  assert.equal(radicand({ m: -1 }), 1);
});

test("√(ab) = √a · √b for non-negative a, b", () => {
  for (const [a, b] of [[2, 8], [3, 12], [0, 5], [0.25, 16], [7, 11]]) {
    assert.ok(Math.abs(sqrtReal(a * b) - sqrtReal(a) * sqrtReal(b)) < 1e-12);
  }
});

test("√(a²b) = a√b with b square-free", () => {
  assert.deepEqual(simplify(72), { a: 6, b: 2 });
  assert.deepEqual(simplify(12), { a: 2, b: 3 });
  assert.deepEqual(simplify(50), { a: 5, b: 2 });
  assert.deepEqual(simplify(49), { a: 7, b: 1 });
  assert.deepEqual(simplify(30), { a: 1, b: 30 });
  for (let m = 1; m <= 300; m++) {
    const { a, b } = simplify(m);
    assert.equal(a * a * b, m);
    assert.ok(squareFree(b), `${m}`);
    assert.ok(Math.abs(a * Math.sqrt(b) - Math.sqrt(m)) < 1e-12);
  }
  assert.ok(squareFree(30) && !squareFree(18) && squareFree(1));
});

test("√x is defined only for x ≥ 0", () => {
  assert.equal(sqrtReal(-4), null);
  assert.equal(sqrtReal(-0.01), null);
  assert.equal(sqrtReal(NaN), null);
  assert.equal(sqrtReal(0), 0);
  assert.equal(sqrtReal(9), 3);
});
