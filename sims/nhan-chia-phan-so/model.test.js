import test from "node:test";
import assert from "node:assert/strict";
import { MAX_N, MAX_D, initialState, operands, gcd, simplify, multiply, reciprocal, divide, calculate, toMixed, area, cellKind, fitting, same, choices, newQuestion } from "./model.js";

const all = function* (step = 1) {
  for (let n1 = 0; n1 <= MAX_N; n1 += step) for (let d1 = 1; d1 <= MAX_D; d1 += step) for (let n2 = 0; n2 <= MAX_N; n2++) for (let d2 = 1; d2 <= MAX_D; d2++) yield [n1, d1, n2, d2];
};
const calc = (op, n1, d1, n2, d2) => calculate({ op, n1, d1, n2, d2 });

test("products in lowest terms", () => {
  assert.deepEqual(multiply(3, 4, 2, 3), { n: 6, d: 12 });
  assert.deepEqual(calc("mul", 3, 4, 2, 3), { raw: { n: 6, d: 12 }, n: 1, d: 2 });
  assert.deepEqual(simplify(6, 12), { n: 1, d: 2 });
  assert.deepEqual(simplify(0, 7), { n: 0, d: 1 });
  assert.deepEqual(simplify(8, 4), { n: 2, d: 1 });
  assert.equal(gcd(12, 18), 6);
  for (const [n1, d1, n2, d2] of all()) {
    const r = calc("mul", n1, d1, n2, d2);
    assert.equal(r.n * d1 * d2, n1 * n2 * r.d); // same value
    assert.equal(gcd(r.n, r.d), 1); // lowest terms
    assert.ok(r.d > 0);
  }
});

test("quotients in lowest terms; dividing = multiplying by the reciprocal", () => {
  assert.deepEqual(reciprocal(2, 3), { n: 3, d: 2 });
  assert.deepEqual(divide(3, 4, 2, 3), { n: 9, d: 8 });
  assert.deepEqual(calc("div", 3, 4, 1, 8), { raw: { n: 24, d: 4 }, n: 6, d: 1 });
  for (const [n1, d1, n2, d2] of all()) {
    if (n2 === 0) continue;
    const q = calc("div", n1, d1, n2, d2);
    const r = reciprocal(n2, d2);
    assert.deepEqual(divide(n1, d1, n2, d2), multiply(n1, d1, r.n, r.d));
    assert.equal(gcd(q.n, q.d), 1);
    // quotient × divisor = dividend
    assert.equal(q.n * n2 * d1, n1 * q.d * d2);
  }
});

test("division by zero is rejected", () => {
  assert.equal(reciprocal(0, 5), null);
  assert.equal(divide(3, 4, 0, 5), null);
  assert.equal(calc("div", 3, 4, 0, 5), null);
  assert.equal(fitting(3, 4, 0, 5), null);
  assert.deepEqual(choices({ op: "div", n1: 3, d1: 4, n2: 0, d2: 5 }), []);
  assert.deepEqual(calc("div", 0, 4, 2, 5), { raw: { n: 0, d: 8 }, n: 0, d: 1 }); // 0 : something is fine
  assert.deepEqual(calc("mul", 3, 4, 0, 5), { raw: { n: 0, d: 20 }, n: 0, d: 1 });
});

test("area model: the overlap is numerator × numerator cells of denominator × denominator per unit square", () => {
  assert.deepEqual(area(3, 4, 2, 3), { cols: 4, rows: 3, unitsX: 1, unitsY: 1, cellsPerUnit: 12, overlap: 6 });
  for (const [n1, d1, n2, d2] of all(3)) {
    const m = area(n1, d1, n2, d2);
    let both = 0;
    let a = 0;
    let b = 0;
    for (let i = 0; i < m.unitsX * m.cols; i++)
      for (let j = 0; j < m.unitsY * m.rows; j++) {
        const kind = cellKind(i, j, n1, d1, n2, d2);
        both += kind === "both";
        a += kind === "both" || kind === "a" ? j < d2 : 0;
        b += kind === "both" || kind === "b" ? i < d1 : 0;
      }
    assert.equal(both, n1 * n2);
    assert.equal(m.overlap, n1 * n2);
    assert.equal(m.cellsPerUnit, d1 * d2);
    // overlap / cellsPerUnit is the product
    const p = calc("mul", n1, d1, n2, d2);
    assert.equal(m.overlap * p.d, p.n * m.cellsPerUnit);
    // the rectangle fits in the drawn unit squares
    assert.ok(n1 <= m.unitsX * d1 && n2 <= m.unitsY * d2);
    if (n1 && n2) assert.ok(a >= n1 * Math.min(n2, d2) && b >= n2 * Math.min(n1, d1));
  }
});

test("results greater than 1: more unit squares, and the mixed number", () => {
  // 3/2 × 5/3 = 15/6 = 5/2 = 2 1/2: the rectangle covers 15 cells, a unit square has 6
  const m = area(3, 2, 5, 3);
  assert.deepEqual([m.unitsX, m.unitsY, m.overlap, m.cellsPerUnit], [2, 2, 15, 6]);
  assert.deepEqual(calc("mul", 3, 2, 5, 3), { raw: { n: 15, d: 6 }, n: 5, d: 2 });
  assert.deepEqual(toMixed(5, 2), { whole: 2, n: 1, d: 2 });
  assert.deepEqual(toMixed(9, 8), { whole: 1, n: 1, d: 8 });
  assert.deepEqual(toMixed(6, 1), { whole: 6, n: 0, d: 1 });
  assert.deepEqual(toMixed(1, 2), { whole: 0, n: 1, d: 2 });
  for (let n = 0; n <= 100; n++) for (let d = 1; d <= 12; d++) {
    const x = toMixed(n, d);
    assert.equal(x.whole * d + x.n, n);
    assert.ok(x.n < d);
  }
});

test("how many times it fits equals the quotient", () => {
  // 3/4 : 1/8: 6 eighths-of-... parts; fits 6 times
  assert.deepEqual(fitting(3, 4, 1, 8), { unit: 32, partsA: 24, partsB: 4, whole: 6, rest: 0 });
  // 3/4 : 1/2 = 1 and a half times
  assert.deepEqual(fitting(3, 4, 1, 2), { unit: 8, partsA: 6, partsB: 4, whole: 1, rest: 2 });
  for (const [n1, d1, n2, d2] of all()) {
    if (n2 === 0) continue;
    const f = fitting(n1, d1, n2, d2);
    const q = calc("div", n1, d1, n2, d2);
    assert.equal(f.partsA * q.d, q.n * f.partsB);
    assert.equal(f.whole * f.partsB + f.rest, f.partsA);
    assert.equal(f.whole, Math.floor(q.n / q.d));
    // the parts really are the two fractions
    assert.equal(f.partsA * d1, n1 * f.unit);
    assert.equal(f.partsB * d2, n2 * f.unit);
  }
});

test("forged operands are clamped", () => {
  assert.deepEqual(operands({ n1: -3, d1: 0, n2: 1e9, d2: "x" }), { n1: 0, d1: 1, n2: MAX_N, d2: 1 });
  assert.deepEqual(operands(initialState()), { n1: 3, d1: 4, n2: 2, d2: 3 });
});

test("practice: six different answers with exactly one right; questions never divide by zero", () => {
  let seed = 5;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
  let q = {};
  for (let i = 0; i < 500; i++) {
    const next = newQuestion(rand, q);
    assert.notDeepEqual(next, q);
    q = next;
    assert.ok(q.n1 >= 1 && q.n1 < q.d1 && q.n2 >= 1 && q.n2 < q.d2 && q.d1 <= 6 && q.d2 <= 6);
    for (const op of ["mul", "div"]) {
      const right = calculate({ op, ...q });
      const list = choices({ op, ...q });
      assert.equal(list.length, 6);
      assert.equal(list.filter(c => same(c, right)).length, 1);
      assert.ok(list.some(c => c.n === right.n && c.d === right.d)); // offered in lowest terms
      for (const c of list) assert.equal(gcd(c.n, c.d), 1);
      for (let k = 1; k < 6; k++) assert.ok(list[k - 1].n * list[k].d < list[k].n * list[k - 1].d); // strictly increasing: all different
    }
  }
  // also for every explorable pair
  for (const [n1, d1, n2, d2] of all(3)) for (const op of ["mul", "div"]) {
    const s = { op, n1, d1, n2, d2 };
    if (calculate(s)) assert.equal(choices(s).filter(c => same(c, calculate(s))).length, 1);
  }
});
