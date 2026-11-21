import test from "node:test";
import assert from "node:assert/strict";
import { initialState, percentOf, wholeFrom, percentRatio, increase, decrease, simplify, toDecimal, solve } from "./model.js";

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`);

test("p % of a", () => {
  assert.equal(percentOf(80, 25), 20);
  assert.equal(percentOf(200, 12), 24);
  assert.equal(percentOf(50, 0), 0);
  assert.equal(percentOf(0, 40), 0);
  assert.equal(percentOf(37, 100), 37);
  near(percentOf(30, 15), 4.5);
});

test("a number from p % and its value", () => {
  assert.equal(wholeFrom(20, 25), 80);
  assert.equal(wholeFrom(24, 12), 200);
  assert.equal(wholeFrom(0, 40), 0);
  near(wholeFrom(9, 30), 30);
  for (const [a, p] of [[80, 25], [120, 35], [7, 1], [199, 99]]) near(wholeFrom(percentOf(a, p), p), a);
});

test("percentage of two numbers", () => {
  assert.equal(percentRatio(20, 80), 25);
  assert.equal(percentRatio(30, 20), 150); // may exceed 100 %
  assert.equal(percentRatio(0, 5), 0);
  near(percentRatio(1, 3), 100 / 3);
  for (const [a, p] of [[80, 25], [120, 35], [7, 1]]) near(percentRatio(percentOf(a, p), a), p);
});

test("division by zero gives no answer instead of Infinity or NaN", () => {
  assert.equal(wholeFrom(20, 0), null);
  assert.equal(wholeFrom(0, 0), null);
  assert.equal(percentRatio(20, 0), null);
  assert.equal(percentRatio(0, 0), null);
  assert.equal(simplify(3, 0), null);
  const a = solve({ ...initialState(), type: "whole", part: 20, percent: 0 });
  assert.equal(a.whole, null);
  assert.equal(a.valid, false);
  const b = solve({ ...initialState(), type: "percent", part: 20, whole: 0 });
  assert.deepEqual([b.percent, b.fraction, b.decimal, b.valid], [null, null, null, false]);
});

test("increase then decrease by the same percentage does not return to the start", () => {
  near(increase(100, 10), 110);
  near(decrease(100, 10), 90);
  near(decrease(increase(100, 10), 10), 99);
  for (const a of [40, 100, 175]) {
    for (const p of [5, 10, 25, 50, 100]) {
      const back = decrease(increase(a, p), p);
      assert.ok(back < a);
      near(back, a * (1 - (p / 100) ** 2));
    }
  }
  near(decrease(increase(100, 0), 0), 100); // only 0 % changes nothing
  const s = solve({ ...initialState(), type: "change", whole: 100, percent: 20, change: "updown" });
  assert.equal(s.steps.length, 3);
  near(s.steps[1], 120);
  near(s.final, 96);
  near(solve({ ...initialState(), type: "change", whole: 100, percent: 20, change: "up" }).final, 120);
  near(solve({ ...initialState(), type: "change", whole: 100, percent: 20, change: "down" }).final, 80);
});

test("fractions are reduced to lowest terms", () => {
  assert.deepEqual(simplify(25, 100), [1, 4]);
  assert.deepEqual(simplify(50, 100), [1, 2]);
  assert.deepEqual(simplify(35, 100), [7, 20]);
  assert.deepEqual(simplify(7, 100), [7, 100]);
  assert.deepEqual(simplify(100, 100), [1, 1]);
  assert.deepEqual(simplify(0, 100), [0, 1]);
  assert.deepEqual(simplify(30, 20), [3, 2]);
  assert.deepEqual(simplify(6, -8), [-3, 4]);
  assert.equal(simplify(2.5, 10), null);
});

test("decimal conversion", () => {
  assert.equal(toDecimal(25), 0.25);
  assert.equal(toDecimal(7), 0.07);
  assert.equal(toDecimal(100), 1);
  assert.equal(toDecimal(150), 1.5);
  assert.equal(toDecimal(0), 0);
});

test("solve finds the third quantity for each problem type", () => {
  const base = initialState();
  const a = solve({ ...base, type: "part", whole: 80, percent: 25, part: 999 });
  assert.deepEqual([a.whole, a.percent, a.part, a.fraction, a.decimal], [80, 25, 20, [1, 4], 0.25]);
  const b = solve({ ...base, type: "whole", whole: 999, percent: 25, part: 20 });
  assert.deepEqual([b.whole, b.percent, b.part], [80, 25, 20]);
  const c = solve({ ...base, type: "percent", whole: 80, percent: 99, part: 20 });
  assert.deepEqual([c.whole, c.percent, c.part, c.fraction, c.decimal], [80, 25, 20, [1, 4], 0.25]);
  const d = solve({ ...base, type: "percent", whole: 3, part: 1 });
  assert.deepEqual(d.fraction, [1, 3]);
  near(d.percent, 100 / 3);
});

test("forged values are rounded and clamped", () => {
  const s = solve({ type: "nonsense", whole: 1e9, percent: -5, part: NaN, change: 3 });
  assert.deepEqual([s.type, s.whole, s.percent, s.part], ["part", 200, 0, 0]);
  assert.equal(solve({ ...initialState(), type: "change", change: "x" }).mode, "updown");
});
