import test from "node:test";
import assert from "node:assert/strict";
import { MAX_A, MAX_B, initialState, whole, divide, divisible, longDivision, shareOf, longOf, questionOf, check, newQuestion, newLong } from "./model.js";

const rng = seed => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);

test("quotient and remainder of known divisions", () => {
  assert.deepEqual(divide(17, 5), { quotient: 3, remainder: 2 });
  assert.deepEqual(divide(15, 5), { quotient: 3, remainder: 0 });
  assert.deepEqual(divide(0, 7), { quotient: 0, remainder: 0 });
  assert.deepEqual(divide(3, 7), { quotient: 0, remainder: 3 });
  assert.deepEqual(divide(60, 1), { quotient: 60, remainder: 0 });
  assert.deepEqual(divide(765, 4), { quotient: 191, remainder: 1 });
  assert.deepEqual(divide(9999, 99), { quotient: 101, remainder: 0 });
});

test("a = b × q + r and 0 ≤ r < b for every pair", () => {
  for (let a = 0; a <= 400; a++)
    for (let b = 1; b <= 40; b++) {
      const { quotient, remainder } = divide(a, b);
      assert.equal(b * quotient + remainder, a);
      assert.ok(remainder >= 0 && remainder < b, `${a} : ${b}`);
      assert.ok(Number.isInteger(quotient) && quotient >= 0);
    }
});

test("division by zero and non-natural operands are rejected", () => {
  assert.equal(divide(5, 0), null);
  assert.equal(divide(0, 0), null);
  assert.equal(divide(5, -2), null);
  assert.equal(divide(-5, 2), null);
  assert.equal(divide(5.5, 2), null);
  assert.equal(divide(NaN, 2), null);
  assert.equal(longDivision(12, 0), null);
  assert.equal(divisible(12, 0), false);
  assert.equal(check(12, 0, 0, 12), "wrong");
});

test("divisibility", () => {
  assert.ok(divisible(12, 3));
  assert.ok(divisible(0, 9));
  assert.ok(!divisible(13, 3));
  for (let a = 0; a <= 200; a++) for (let b = 1; b <= 20; b++) assert.equal(divisible(a, b), a % b === 0);
});

test("long division of 765 : 4 goes 7, 36, 5 as on paper", () => {
  const { steps, quotient, remainder } = longDivision(765, 4);
  assert.deepEqual(
    steps.map(s => [s.col, s.partial, s.q, s.product, s.remainder]),
    [
      [0, 7, 1, 4, 3],
      [1, 36, 9, 36, 0],
      [2, 5, 1, 4, 1],
    ]
  );
  assert.equal(quotient, 191);
  assert.equal(remainder, 1);
});

test("long division starts with enough digits and keeps zeros inside the quotient", () => {
  // 7 < 9, so the first step uses 76
  assert.deepEqual(longDivision(765, 9).steps[0], { col: 1, digit: 6, partial: 76, q: 8, product: 72, remainder: 4 });
  // 824 : 4 = 206: the middle quotient digit is 0
  assert.deepEqual(longDivision(824, 4).steps.map(s => s.q), [2, 0, 6]);
  // dividend smaller than the divisor: one step, quotient 0
  const small = longDivision(3, 7);
  assert.equal(small.steps.length, 1);
  assert.deepEqual([small.quotient, small.remainder], [0, 3]);
  assert.deepEqual(longDivision(0, 5).steps.map(s => s.q), [0]);
  // two-digit divisor
  assert.deepEqual(longDivision(1000, 25).steps.map(s => s.q), [4, 0]);
});

test("long-division digits, products and remainders agree with the division for many pairs", () => {
  for (let a = 0; a <= 9999; a += 7)
    for (const b of [2, 3, 4, 7, 9, 11, 12, 25, 47, 99]) {
      const { steps, quotient, remainder } = longDivision(a, b);
      const d = divide(a, b);
      assert.equal(quotient, d.quotient, `${a} : ${b}`);
      assert.equal(remainder, d.remainder);
      assert.equal(steps.at(-1).col, String(a).length - 1);
      assert.ok(steps.length <= 4);
      for (const s of steps) {
        assert.ok(s.q >= 0 && s.q <= 9, "one digit per step");
        assert.equal(s.product, s.q * b);
        assert.equal(s.remainder, s.partial - s.product);
        assert.ok(s.remainder >= 0 && s.remainder < b);
      }
      // each next partial is the previous remainder with the next digit brought down
      for (let i = 1; i < steps.length; i++) assert.equal(steps[i].partial, steps[i - 1].remainder * 10 + steps[i].digit);
    }
});

test("practice answers are judged, and a too-large remainder gets its own verdict", () => {
  assert.equal(check(23, 4, 5, 3), "correct");
  assert.equal(check(23, 4, 4, 7), "remainder-too-big"); // 4 × 4 + 7 = 23 but 7 ≥ 4
  assert.equal(check(23, 4, 5, 2), "wrong");
  assert.equal(check(23, 4, 6, 0), "wrong");
  assert.equal(check(20, 4, 5, 0), "correct");
  assert.equal(check(20, 4, 4, 4), "remainder-too-big");
});

test("new questions fit the answer sliders and differ from the current one", () => {
  const rand = rng(7);
  let cur = { qa: 23, qb: 4 };
  for (let i = 0; i < 500; i++) {
    const q = newQuestion(rand, cur);
    assert.ok(q.qa !== cur.qa || q.qb !== cur.qb);
    const d = divide(q.qa, q.qb);
    assert.ok(q.qb >= 2 && q.qb <= 9 && q.qa <= 99);
    assert.ok(d.quotient >= 1 && d.quotient <= 12 && d.remainder <= 9);
    cur = q;
    const big = newLong(rand);
    assert.ok(big.bigA >= 100 && big.bigA <= 9999 && big.bigB >= 2 && big.bigB <= 99);
  }
});

test("forged state is clamped before it reaches the picture", () => {
  assert.deepEqual(shareOf({ a: 1e9, b: -3 }), { a: MAX_A, b: 0 });
  assert.deepEqual(shareOf({ a: "x", b: 99 }), { a: 0, b: MAX_B });
  assert.deepEqual(longOf({ bigA: -5, bigB: 0 }), { a: 0, b: 2 });
  assert.deepEqual(questionOf({ qa: 1e6, qb: 0 }), { a: 99, b: 2 });
  assert.equal(whole(NaN, 1, 5), 1);
  const s = initialState();
  assert.deepEqual(divide(s.a, s.b), { quotient: 3, remainder: 2 });
});
