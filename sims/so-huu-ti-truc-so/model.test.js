import test from "node:test";
import assert from "node:assert/strict";
import * as m from "./model.js";

test("position of p/q: unit segment and number of parts", () => {
  assert.deepEqual(m.locate(3, 4), { unit: 0, part: 3 });
  assert.deepEqual(m.locate(5, 4), { unit: 1, part: 1 });
  assert.deepEqual(m.locate(-3, 4), { unit: -1, part: 1 }); // −3/4 = −1 + 1/4
  assert.deepEqual(m.locate(-8, 4), { unit: -2, part: 0 });
  for (let q = 1; q <= m.Q_MAX; q++)
    for (let p = -m.P_MAX; p <= m.P_MAX; p++) {
      const { unit, part } = m.locate(p, q);
      assert.ok(part >= 0 && part < q);
      assert.equal(unit * q + part, p);
      assert.equal(m.snap(p / q, q), p); // a mark snaps to itself
    }
  assert.equal(m.snap(0.7, 4), 3);
  assert.equal(m.snap(-0.4, 3), -1);
  assert.equal(m.snap(99, 2), m.P_MAX);
});

test("reduce keeps the value and makes the denominator positive", () => {
  assert.deepEqual(m.reduce(6, 8), [3, 4]);
  assert.deepEqual(m.reduce(3, -12), [-1, 4]);
  assert.deepEqual(m.reduce(0, 5), [0, 1]);
  assert.deepEqual(m.reduce(-12, 4), [-3, 1]);
});

test("comparison agrees with the values and with a common denominator", () => {
  assert.equal(m.compare(3, 4, 2, 3), 1);
  assert.equal(m.compare(-3, 4, -2, 3), -1);
  assert.equal(m.compare(1, 2, 2, 4), 0);
  assert.equal(m.compare(-1, 12, 0, 5), -1);
  for (const [a, b, c, d] of [[5, 6, 7, 8], [-5, 6, 7, 8], [11, 12, 10, 11], [-7, 3, -9, 4]]) {
    assert.equal(m.compare(a, b, c, d), Math.sign(a / b - c / d));
    const k = m.lcm(b, d);
    assert.equal(m.compare(a, b, c, d), Math.sign(a * (k / b) - c * (k / d)));
  }
  assert.equal(m.lcm(4, 6), 12);
});

test("finite decimal iff the reduced denominator has only the prime factors 2 and 5", () => {
  for (let q = 1; q <= 200; q++)
    for (const p of [1, 3, 6, 7, 10, 35]) {
      let d = m.reduce(p, q)[1];
      while (d % 2 === 0) d /= 2;
      while (d % 5 === 0) d /= 5;
      assert.equal(m.isFiniteDecimal(p, q), d === 1, `${p}/${q}`);
      assert.equal(m.periodLength(p, q) === 0, d === 1, `${p}/${q}`);
    }
  assert.equal(m.isFiniteDecimal(3, 6), true); // 3/6 = 1/2
  assert.equal(m.isFiniteDecimal(1, 6), false);
  assert.equal(m.isFiniteDecimal(7, 40), true);
  assert.deepEqual(m.primeFactors(12), [2, 2, 3]);
});

test("repeating block and its length", () => {
  assert.equal(m.decimalText(1, 3), "0,(3)");
  assert.equal(m.decimalText(1, 6), "0,1(6)");
  assert.equal(m.decimalText(5, 12), "0,41(6)");
  assert.equal(m.decimalText(-17, 11), "−1,(54)");
  assert.equal(m.decimalText(1, 7), "0,(142857)");
  assert.equal(m.decimalText(3, 4), "0,75");
  assert.equal(m.decimalText(-5, 4), "−1,25");
  assert.equal(m.decimalText(8, 4), "2");
  assert.equal(m.decimalText(0, 7), "0");
  assert.equal(m.periodLength(1, 7), 6);
  assert.equal(m.periodLength(1, 11), 2);
  assert.equal(m.periodLength(1, 12), 1);
  assert.equal(m.periodLength(1, 8), 0);
  assert.deepEqual(m.decimal(1, 12), { negative: false, whole: 0, pre: "08", rep: "3" });
});

test("decimal back to fraction gives the same number", () => {
  assert.deepEqual(m.fromDecimal(m.decimal(1, 6)), { all: 16, minus: 1, num: 15, den: 90 });
  assert.deepEqual(m.fromDecimal(m.decimal(3, 4)), { all: 75, minus: 0, num: 75, den: 100 });
  for (let q = 1; q <= m.Q_MAX; q++)
    for (let p = -m.P_MAX; p <= m.P_MAX; p++) {
      const f = m.fromDecimal(m.decimal(p, q));
      assert.deepEqual(m.reduce(f.num, f.den), m.reduce(p, q), `${p}/${q}`);
    }
});

test("opposite numbers and |x| as the distance to 0", () => {
  for (const [p, q] of [[3, 4], [-5, 3], [0, 2], [-12, 1]]) {
    const [op, oq] = m.opposite(p, q);
    assert.equal(p / q + op / oq, 0);
    assert.equal(m.distance(p, q), m.distance(op, oq)); // a number and its opposite are equally far from 0
    assert.equal(m.distance(p, q), Math.abs(p / q - 0));
    const [ap, aq] = m.absolute(p, q);
    assert.equal(ap / aq, m.distance(p, q));
    assert.ok(ap / aq >= 0);
  }
  assert.ok(Object.is(m.opposite(0, 5)[0], 0));
});

test("line range leaves room for every value", () => {
  assert.equal(m.lineRange([0.75]), 2);
  assert.equal(m.lineRange([-2.5, 1]), 3);
  assert.equal(m.lineRange([12]), 13);
});

test("ordering a list", () => {
  assert.equal(m.sortedOrder(m.SETS[0]), "1032"); // −0,75 < 1/2 < 0,6 < 2/3
  assert.equal(m.sortedOrder(m.SETS[3]), "1032"); // 0,3 < 0,(3) < 0,35 < 2/5
  assert.equal(m.sortedOrder(m.SETS[4]), "3201"); // −0,(8) < −7/8 < −5/6 < −0,8
  for (const set of m.SETS) {
    const values = set.map(([p, q]) => p / q);
    assert.equal(new Set(values).size, set.length, "values are distinct");
    assert.equal(m.isOrdered(set, "0123"), false, "a set never starts in order");
    const right = m.sortedOrder(set);
    assert.ok(m.isOrdered(set, right));
    assert.deepEqual([...right].map(i => values[i]), [...values].sort((a, b) => a - b));
    assert.equal(m.isOrdered(set, [...right].reverse().join("")), false);
    for (const [p, q, form] of set) if (form === "d") assert.ok(m.decimalText(p, q).length <= 7);
  }
  assert.equal(m.swap("0123", 0, 3), "3120");
  assert.equal(m.swap("0123", 0, 9), "0123");
  assert.deepEqual(m.parseOrder("2031"), [2, 0, 3, 1]);
  assert.deepEqual(m.parseOrder("0012"), [0, 1, 2, 3]); // forged
  assert.deepEqual(m.parseOrder(42), [0, 1, 2, 3]);
  assert.equal(m.setAt(-1), m.SETS.at(-1));
  assert.equal(m.setAt(1e9 + 0.5).length, 4);
  const s = m.nextSet({ ...m.initialState(), setIndex: m.SETS.length - 1, order: "3210", status: "right" });
  assert.deepEqual([s.setIndex, s.order, s.status], [0, "0123", ""]);
});

test("forged state is clamped", () => {
  const n = m.numbers({ num: 1e9, den: 0, num2: NaN, den2: -4 });
  assert.deepEqual(n, { a: [12, 1], b: [0, 1] });
});
