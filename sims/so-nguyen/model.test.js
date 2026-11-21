import test from "node:test";
import assert from "node:assert/strict";
import { MIN, MAX, initialState, compute, arrows, counters, current, isCorrect, newQuestion, expression } from "./model.js";

const range = [];
for (let n = MIN; n <= MAX; n++) range.push(n);

test("sums and differences over the whole range", () => {
  for (const a of range) {
    for (const b of range) {
      assert.equal(compute(a, b, "add").result, a + b);
      assert.equal(compute(a, b, "sub").result, a - b);
      assert.equal(compute(a, b, 1).result, a + b);
      assert.equal(compute(a, b, -1).result, a - b);
    }
  }
});

test("a − b = a + (−b)", () => {
  for (const a of range) {
    for (const b of range) {
      assert.equal(compute(a, b, "sub").result, compute(a, -b, "add").result);
      assert.equal(compute(a, b, "sub").move, compute(a, -b, "add").move);
    }
  }
});

test("the arrows start at 0, pass through a and end at the result", () => {
  for (const a of range) {
    for (const b of range) {
      for (const op of ["add", "sub"]) {
        const [first, second] = arrows(a, b, op);
        assert.equal(first.from, 0);
        assert.equal(first.to, a);
        assert.equal(second.from, a);
        assert.equal(second.to, compute(a, b, op).result);
        assert.equal(Math.abs(second.to - second.from), Math.abs(b));
      }
    }
  }
});

test("counters cancel in pairs and what is left is the result", () => {
  for (const a of range) {
    for (const b of range) {
      for (const op of ["add", "sub"]) {
        const c = counters(a, b, op);
        const { result } = compute(a, b, op);
        assert.equal(c.leftPositive - c.leftNegative, result);
        assert.ok(c.leftPositive === 0 || c.leftNegative === 0); // only one colour is left
        assert.equal(c.positive + c.negative, Math.abs(a) + Math.abs(b));
        assert.equal(c.positive - c.pairs, c.leftPositive);
      }
    }
  }
  assert.deepEqual(counters(4, 7, "sub"), { positive: 4, negative: 7, pairs: 4, leftPositive: 0, leftNegative: 3 });
  assert.deepEqual(counters(-3, -5, "sub"), { positive: 5, negative: 3, pairs: 3, leftPositive: 2, leftNegative: 0 });
  assert.equal(counters(3, 5, "add").pairs, 0);
});

test("practice accepts only the right answer", () => {
  const s = { ...initialState(), practice: true, qa: -3, qb: 5, qop: -1 };
  for (let answer = -20; answer <= 20; answer++) {
    assert.equal(isCorrect({ ...s, answer }), answer === -8);
  }
  assert.equal(isCorrect({ ...s, answer: -8.5 }), false);
  assert.equal(isCorrect({ ...s, answer: "-8" }), false);
});

test("new questions stay in range and are reproducible from the random source", () => {
  let seed = 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < 500; i++) {
    const s = newQuestion({ ...initialState(), practice: true, status: "right", answer: 9 }, rnd);
    assert.ok(Number.isInteger(s.qa) && s.qa >= MIN && s.qa <= MAX);
    assert.ok(Number.isInteger(s.qb) && s.qb >= MIN && s.qb <= MAX && s.qb !== 0);
    assert.ok(s.qop === 1 || s.qop === -1);
    assert.equal(s.status, "");
    assert.equal(s.answer, 0);
    assert.equal(current(s).result, s.qop === 1 ? s.qa + s.qb : s.qa - s.qb);
  }
});

test("forged values are rounded and clamped", () => {
  assert.deepEqual(compute(99, -99, "add"), { a: 10, b: -10, sign: 1, move: -10, result: 0 });
  assert.equal(compute(2.4, NaN, "sub").result, 2);
  assert.equal(current({ ...initialState(), practice: true, qa: 1e9, qb: 0.2, qop: 7 }).result, 10);
});

test("negative numbers are written in brackets", () => {
  assert.equal(expression(3, -5, "add"), "3 + (−5)");
  assert.equal(expression(-3, 5, "sub"), "(−3) − 5 = (−3) + (−5)");
  assert.equal(expression(4, -7, "sub"), "4 − (−7) = 4 + 7");
});
