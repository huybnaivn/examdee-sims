import test from "node:test";
import assert from "node:assert/strict";
import { MAX, initialState, fraction, read, gcd, compare, simplify, toMixed, equivalents, terminates } from "./model.js";

const f = (n, d) => ({ n, d });

test("comparison by cross-multiplication, including equal fractions", () => {
  assert.equal(compare(f(2, 4), f(1, 2)), 0);
  assert.equal(compare(f(3, 4), f(5, 6)), -1);
  assert.equal(compare(f(5, 3), f(6, 8)), 1);
  assert.equal(compare(f(0, 7), f(0, 3)), 0);
  for (let n1 = 0; n1 <= MAX; n1++)
    for (let d1 = 1; d1 <= MAX; d1++)
      for (let n2 = 0; n2 <= MAX; n2++)
        for (let d2 = 1; d2 <= MAX; d2++)
          assert.equal(compare(f(n1, d1), f(n2, d2)), Math.sign(n1 / d1 - n2 / d2), `${n1}/${d1} vs ${n2}/${d2}`);
});

test("simplification divides by the gcd", () => {
  assert.equal(gcd(12, 8), 4);
  assert.equal(gcd(7, 5), 1);
  assert.equal(gcd(0, 5), 5);
  assert.deepEqual(simplify(f(6, 8)), f(3, 4));
  assert.deepEqual(simplify(f(12, 4)), f(3, 1));
  assert.deepEqual(simplify(f(0, 5)), f(0, 1));
  for (let n = 0; n <= MAX; n++)
    for (let d = 1; d <= MAX; d++) {
      const s = simplify(f(n, d));
      assert.equal(gcd(s.n, s.d), 1);
      assert.equal(s.n * gcd(n, d), n);
      assert.equal(s.d * gcd(n, d), d);
      assert.equal(compare(s, f(n, d)), 0);
    }
});

test("mixed-number conversion", () => {
  assert.deepEqual(toMixed(f(7, 4)), { whole: 1, n: 3, d: 4 });
  assert.deepEqual(toMixed(f(10, 4)), { whole: 2, n: 1, d: 2 });
  assert.deepEqual(toMixed(f(8, 4)), { whole: 2, n: 0, d: 1 });
  assert.deepEqual(toMixed(f(3, 4)), { whole: 0, n: 3, d: 4 });
  for (let n = 0; n <= MAX; n++)
    for (let d = 1; d <= MAX; d++) {
      const m = toMixed(f(n, d));
      assert.ok(m.n >= 0 && m.n < m.d);
      assert.equal(compare(f(m.whole * m.d + m.n, m.d), f(n, d)), 0);
    }
});

test("denominator can never be 0", () => {
  for (const d of [0, -3, 0.2, NaN, Infinity, "abc", undefined, null]) {
    const { d: safe } = fraction(3, d);
    assert.ok(Number.isInteger(safe) && safe >= 1 && safe <= MAX, `denominator from ${d}`);
  }
  const { a, b } = read({ ...initialState(), d1: 0, d2: -1, n1: -4, n2: 2.6 });
  assert.deepEqual([a.d, b.d, a.n, b.n], [1, 1, 0, 3]);
});

test("equivalent fractions are equal to the original", () => {
  assert.deepEqual(equivalents(f(2, 4), 3), [f(1, 2), f(2, 4), f(3, 6)]);
  for (const e of equivalents(f(6, 8), 6)) assert.equal(compare(e, f(6, 8)), 0);
});

test("terminating decimals", () => {
  assert.ok(terminates(f(1, 8)));
  assert.ok(terminates(f(3, 6)));
  assert.ok(!terminates(f(1, 3)));
  assert.ok(!terminates(f(5, 12)));
});
