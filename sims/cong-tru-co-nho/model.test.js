import test from "node:test";
import assert from "node:assert/strict";
import { MAX, initialState, whole, valid, answer, columns, fromDigits, carries, stepOf, checkDigit, blocks, value, newQuestion } from "./model.js";

const lcg = seed => () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pairs = function* (n = 400) {
  const r = lcg(7);
  yield* [[0, 0], [9999, 9999], [9999, 1], [1000, 1], [1000, 999], [5, 5], [368, 257], [100, 100]];
  for (let i = 0; i < n; i++) yield [Math.floor(r() * (MAX + 1)), Math.floor(r() * (MAX + 1))];
};

test("addition: digits and carries column by column", () => {
  // 368 + 257: 8+7=15 viết 5 nhớ 1; 6+5+1=12 viết 2 nhớ 1; 3+2+1=6
  const cols = columns(368, 257, "add");
  assert.deepEqual(cols.map(c => c.digit), [5, 2, 6]);
  assert.deepEqual(cols.map(c => c.carryOut), [1, 1, 0]);
  assert.deepEqual(cols.map(c => c.sum), [15, 12, 6]);
  assert.equal(carries(cols), 2);
  assert.equal(fromDigits(cols), 625);
  // a carry out of the last column becomes one more digit
  assert.deepEqual(columns(700, 500, "add").map(c => c.digit), [0, 0, 2, 1]);
  assert.deepEqual(columns(9999, 1, "add").map(c => c.digit), [0, 0, 0, 0, 1]);
  assert.equal(carries(columns(9999, 1, "add")), 4);
  assert.equal(carries(columns(123, 456, "add")), 0);
  // numbers of different lengths
  assert.deepEqual(columns(368, 7, "add").map(c => [c.digit, c.hasY]), [[5, true], [7, false], [3, false]]);
});

test("addition: the written digits always make a + b", () => {
  for (const [a, b] of pairs()) {
    const cols = columns(a, b, "add");
    assert.equal(fromDigits(cols), a + b);
    assert.equal(answer(a, b, "add"), a + b);
    for (const c of cols) assert.ok(c.digit >= 0 && c.digit <= 9 && c.sum === c.x + c.y + c.carryIn);
  }
});

test("subtraction: digits and borrows column by column", () => {
  // 432 − 157: 2 không trừ được 7, 12−7=5 nhớ 1; 5 thêm 1 = 6, 13−6=7 nhớ 1; 1 thêm 1 = 2, 4−2=2
  const cols = columns(432, 157, "sub");
  assert.deepEqual(cols.map(c => c.digit), [5, 7, 2]);
  assert.deepEqual(cols.map(c => c.carryOut), [1, 1, 0]);
  assert.equal(carries(cols), 2);
  assert.deepEqual(columns(1000, 1, "sub").map(c => c.digit), [9, 9, 9, 0]);
  assert.equal(carries(columns(1000, 1, "sub")), 3);
  assert.equal(carries(columns(987, 123, "sub")), 0);
  for (const [p, q] of pairs()) {
    const [a, b] = p >= q ? [p, q] : [q, p];
    const c = columns(a, b, "sub");
    assert.equal(fromDigits(c), a - b);
    assert.equal(c.at(-1).carryOut, 0);
    for (const x of c) assert.ok(x.digit >= 0 && x.digit <= 9);
  }
});

test("a larger subtrahend is rejected at this level", () => {
  assert.equal(valid(257, 368, "sub"), false);
  assert.equal(columns(257, 368, "sub"), null);
  assert.equal(answer(257, 368, "sub"), null);
  assert.equal(blocks(257, 368, "sub", 1), null);
  assert.equal(valid(368, 368, "sub"), true);
  assert.equal(answer(368, 368, "sub"), 0);
  assert.equal(valid(257, 368, "add"), true);
  assert.equal(stepOf({ a: 257, b: 368, op: "sub", step: 3 }), 0);
});

test("blocks, addition: the picture is worth a + b at every step and ends as the digits of the sum", () => {
  assert.deepEqual(blocks(368, 257, "add", 0).have, [15, 11, 5, 0, 0]);
  assert.deepEqual(blocks(368, 257, "add", 1), { have: [5, 12, 5, 0, 0], removed: [0, 0, 0, 0, 0], moves: [{ from: 0, to: 1 }] });
  for (const [a, b] of pairs(150)) {
    const cols = columns(a, b, "add");
    for (let k = 0; k <= cols.length; k++) {
      const pic = blocks(a, b, "add", k);
      assert.equal(value(pic.have), a + b);
      // the column about to be done holds exactly the sum the learner says
      if (k < cols.length) assert.equal(pic.have[cols[k].place], cols[k].sum);
      for (let p = 0; p < k; p++) assert.equal(pic.have[cols[p].place], cols[p].digit);
      assert.ok(pic.have.every(n => n >= 0 && n <= 19));
    }
  }
});

test("blocks, subtraction: blocks left + blocks taken = a at every step; what is left ends as a − b", () => {
  // 1000 − 1: one thousand is broken down through hundreds and tens
  assert.deepEqual(blocks(1000, 1, "sub", 1), {
    have: [9, 9, 9, 0, 0],
    removed: [1, 0, 0, 0, 0],
    moves: [{ from: 3, to: 2 }, { from: 2, to: 1 }, { from: 1, to: 0 }],
  });
  for (const [p, q] of pairs(150)) {
    const [a, b] = p >= q ? [p, q] : [q, p];
    const cols = columns(a, b, "sub");
    for (let k = 0; k <= cols.length; k++) {
      const pic = blocks(a, b, "sub", k);
      assert.equal(value(pic.have) + value(pic.removed), a);
      assert.equal(value(pic.removed), b % 10 ** k);
      assert.ok(pic.have.every((n, i) => n >= 0 && n + pic.removed[i] <= 19));
    }
    const end = blocks(a, b, "sub", cols.length);
    assert.equal(value(end.have), a - b);
    assert.ok(end.have.every(n => n <= 9));
  }
});

test("forged values are clamped", () => {
  assert.equal(whole("x", 0, MAX), 0);
  assert.equal(whole(1e9, 0, MAX), MAX);
  assert.equal(stepOf({ a: 368, b: 257, op: "add", step: 99 }), 3);
  assert.equal(stepOf({ a: 368, b: 257, op: "add", step: -4 }), 0);
  assert.equal(stepOf({ a: 368, b: 257, op: "add", step: NaN }), 0);
  assert.equal(stepOf(initialState()), 1);
});

test("practice: random questions are valid, have a carry, and only the right digit is accepted", () => {
  const r = lcg(42);
  for (let i = 0; i < 600; i++) {
    const op = i % 2 ? "sub" : "add";
    const size = 2 + (i % 3);
    const { a, b } = newQuestion(r, op, size);
    assert.ok(Number.isInteger(a) && Number.isInteger(b) && a >= 10 && a <= MAX && b >= 1 && b <= MAX, `${a} ${b}`);
    assert.equal(String(a).length, size);
    assert.ok(valid(a, b, op));
    const cols = columns(a, b, op);
    assert.ok(carries(cols) >= 1);
    cols.forEach((c, k) => {
      for (let d = 0; d <= 9; d++) assert.equal(checkDigit(cols, k, d), d === c.digit);
    });
    assert.equal(checkDigit(cols, cols.length, 0), false);
  }
  assert.equal(checkDigit(null, 0, 0), false);
});
