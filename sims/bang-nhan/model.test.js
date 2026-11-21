import test from "node:test";
import assert from "node:assert/strict";
import { MIN, MAX, side, product, sentence, addends, divisions, rotate, isCorrect, choices, newQuestion } from "./model.js";

const all = function* () {
  for (let r = MIN; r <= MAX; r++) for (let c = MIN; c <= MAX; c++) yield [r, c];
};

test("products and the textbook order of the sentence", () => {
  assert.equal(product(3, 5), 15);
  assert.equal(product(10, 10), 100);
  assert.equal(product(1, 7), 7);
  // 3 rows of 5: "5 được lấy 3 lần", 5 × 3 = 15
  assert.deepEqual(sentence(3, 5), { a: 5, b: 3, p: 15 });
  for (const [r, c] of all()) assert.equal(product(r, c), r * c);
});

test("repeated addition equals the product", () => {
  assert.deepEqual(addends(3, 5), [5, 5, 5]);
  for (const [r, c] of all()) {
    const terms = addends(r, c);
    assert.equal(terms.length, r);
    assert.equal(terms.reduce((x, y) => x + y, 0), product(r, c));
  }
});

test("rotating swaps rows and columns and keeps the product (commutativity)", () => {
  assert.deepEqual(rotate({ rows: 3, columns: 5 }), { rows: 5, columns: 3 });
  for (const [r, c] of all()) {
    const t = rotate({ rows: r, columns: c });
    assert.equal(product(t.rows, t.columns), product(r, c));
    assert.deepEqual(rotate(t), { rows: r, columns: c });
  }
});

test("division undoes multiplication", () => {
  assert.deepEqual(divisions(3, 5), [
    { dividend: 15, divisor: 3, quotient: 5 },
    { dividend: 15, divisor: 5, quotient: 3 },
  ]);
  for (const [r, c] of all()) {
    const [byRows, byColumns] = divisions(r, c);
    assert.equal(byRows.quotient, c);
    assert.equal(byColumns.quotient, r);
    assert.equal(byRows.quotient * byRows.divisor, byRows.dividend);
  }
});

test("practice: twelve different buttons, exactly one right answer, only it is accepted", () => {
  for (const [r, c] of all()) {
    const options = choices(r, c);
    assert.equal(options.length, 12);
    assert.equal(new Set(options).size, 12);
    assert.ok(options.every(v => Number.isInteger(v) && v > 0));
    assert.deepEqual(options, [...options].sort((x, y) => x - y));
    assert.deepEqual(options.filter(v => isCorrect(r, c, v)), [r * c]);
  }
  assert.ok(isCorrect(4, 6, 24));
  assert.ok(!isCorrect(4, 6, 20) && !isCorrect(4, 6, 10) && !isCorrect(4, 6, "24"));
  assert.deepEqual(choices(4, 6), choices(4, 6)); // stable for one question
});

test("new questions stay in range and change", () => {
  let x = 0.37;
  const rand = () => (x = (x * 9301 + 0.49297) % 1);
  let q = { rows: 3, columns: 5 };
  for (let i = 0; i < 200; i++) {
    const n = newQuestion(rand, q);
    assert.ok(n.rows >= 2 && n.rows <= 10 && n.columns >= 2 && n.columns <= 10);
    assert.ok(n.rows !== q.rows || n.columns !== q.columns);
    q = n;
  }
});

test("forged sides are clamped to whole numbers 1..10", () => {
  for (const [v, want] of [[0, 1], [-4, 1], [11, 10], [2.6, 3], [NaN, 1], ["x", 1], [1e9, 10]]) assert.equal(side(v), want);
});
