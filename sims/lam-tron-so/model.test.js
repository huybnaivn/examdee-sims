import test from "node:test";
import assert from "node:assert/strict";
import { SCALE, MAX, PLACES, placeOf, initialState, valueOf, partsOf, roundTo, marks, digitAt, nextDigit, format, leadingUnit, E_PLACES, estimate, estimateOf, questionOf, isCorrect, newQuestion } from "./model.js";

const rng = seed => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const th = x => Math.round(x * SCALE); // decimal → thousandths
const U = { hundredth: 10, tenth: 100, one: 1000, ten: 10000, hundred: 100000, thousand: 1000000 };
const r = (x, unit) => roundTo(th(x), unit) / SCALE;

test("rounding a natural number to tens, hundreds and thousands", () => {
  assert.equal(r(2847, U.ten), 2850);
  assert.equal(r(2847, U.hundred), 2800);
  assert.equal(r(2847, U.thousand), 3000);
  assert.equal(r(2844, U.ten), 2840);
  assert.equal(r(49, U.hundred), 0);
  assert.equal(r(50, U.hundred), 100);
  assert.equal(r(9999, U.thousand), 10000);
  assert.equal(r(9999, U.ten), 10000);
  assert.equal(r(499, U.thousand), 0);
});

test("rounding decimals to units, tenths and hundredths", () => {
  assert.equal(r(2847.36, U.ten), 2850);
  assert.equal(r(2847.36, U.one), 2847);
  assert.equal(r(2847.36, U.tenth), 2847.4);
  assert.equal(r(3.14159, U.hundredth), 3.14);
  assert.equal(r(3.146, U.hundredth), 3.15);
  assert.equal(r(0.049, U.tenth), 0);
  assert.equal(r(0.996, U.hundredth), 1);
  assert.equal(r(12.3, U.one), 12);
  assert.equal(r(12.7, U.one), 13);
});

test("the rule for 5: a half rounds up, exactly, also where binary fractions would fail", () => {
  assert.equal(r(25, U.ten), 30);
  assert.equal(r(250, U.hundred), 300);
  assert.equal(r(2500, U.thousand), 3000);
  assert.equal(r(0.5, U.one), 1);
  assert.equal(r(2.5, U.one), 3);
  assert.equal(r(3.5, U.one), 4); // not "round half to even"
  assert.equal(r(2.45, U.tenth), 2.5);
  assert.equal(r(1.005, U.hundredth), 1.01); // 1.005 * 100 = 100.49999… in floating point
  assert.equal(r(8.345, U.hundredth), 8.35);
  assert.equal(r(0.15, U.tenth), 0.2);
  assert.equal(r(2.449, U.tenth), 2.4); // only the first dropped digit decides
});

test("negative numbers are rounded through their opposite", () => {
  assert.equal(r(-2847, U.ten), -2850);
  assert.equal(r(-2843, U.ten), -2840);
  assert.equal(r(-2.5, U.one), -3);
  assert.equal(r(-25, U.ten), -30);
  assert.equal(r(-3.14159, U.hundredth), -3.14);
  assert.equal(r(-0.25, U.tenth), -0.3);
  assert.ok(Object.is(r(-0.04, U.tenth), 0), "no negative zero");
  const rand = rng(4);
  for (let i = 0; i < 2000; i++) {
    const m = Math.floor(rand() * MAX);
    for (const p of PLACES) assert.equal(roundTo(-m, p.unit), -roundTo(m, p.unit) || 0);
  }
});

test("a number already at the place is returned unchanged, and rounding twice changes nothing", () => {
  assert.equal(r(2850, U.ten), 2850);
  assert.equal(r(3000, U.thousand), 3000);
  assert.equal(r(2.5, U.tenth), 2.5);
  assert.equal(r(-7.25, U.hundredth), -7.25);
  assert.equal(r(0, U.hundred), 0);
  const rand = rng(9);
  for (let i = 0; i < 2000; i++) {
    const m = Math.floor((rand() * 2 - 1) * MAX);
    for (const p of PLACES) {
      const once = roundTo(m, p.unit);
      assert.equal(Math.abs(once % p.unit), 0, "a multiple of the unit");
      assert.equal(roundTo(once, p.unit), once);
      assert.ok(Math.abs(once - m) <= p.unit / 2, "never more than half a unit away");
      if (m % p.unit === 0) assert.equal(once, m);
    }
  }
});

test("the rounded value is the nearer of the two marks", () => {
  assert.deepEqual(marks(th(2847.36), U.ten), { lo: th(2840), hi: th(2850), mid: th(2845), toLo: th(7.36), toHi: th(2.64), onMark: false });
  assert.deepEqual(marks(th(-2.5), U.one), { lo: th(-3), hi: th(-2), mid: th(-2.5), toLo: 500, toHi: 500, onMark: false });
  assert.ok(marks(th(2850), U.ten).onMark);
  const rand = rng(2);
  for (let i = 0; i < 3000; i++) {
    const m = Math.floor((rand() * 2 - 1) * MAX);
    for (const p of PLACES) {
      const k = marks(m, p.unit);
      assert.ok(k.lo <= m && m < k.hi);
      assert.equal(k.toLo + k.toHi, p.unit);
      const got = roundTo(m, p.unit);
      if (k.toLo < k.toHi) assert.equal(got, k.lo);
      else if (k.toLo > k.toHi) assert.equal(got, k.hi);
      else assert.equal(got, m >= 0 ? k.hi : k.lo); // the half: up for positives, through the opposite for negatives
    }
  }
});

test("the digit rule agrees with the number line", () => {
  assert.equal(digitAt(th(2847.36), U.ten), 4);
  assert.equal(nextDigit(th(2847.36), U.ten), 7);
  assert.equal(nextDigit(th(2847.36), U.tenth), 6);
  assert.equal(nextDigit(th(2847.36), U.hundredth), 0);
  assert.equal(digitAt(th(-3.14), U.tenth), 1);
  const rand = rng(6);
  for (let i = 0; i < 3000; i++) {
    const m = Math.floor(rand() * MAX);
    for (const p of PLACES) {
      const down = Math.floor(m / p.unit) * p.unit;
      assert.equal(roundTo(m, p.unit), nextDigit(m, p.unit) >= 5 ? down + p.unit : down);
    }
  }
});

test("numbers are written with a decimal comma", () => {
  assert.equal(format(th(2847.36)), "2847,36");
  assert.equal(format(th(2850), 0), "2850");
  assert.equal(format(th(2.5), 2), "2,50");
  assert.equal(format(th(-0.3), 1), "−0,3");
  assert.equal(format(0), "0");
  assert.equal(format(th(10000)), "10 000");
  assert.equal(format(th(1234567)), "1 234 567");
  assert.equal(format(5), "0,005");
});

test("state ↔ number", () => {
  const s = initialState();
  assert.equal(valueOf(s), th(2847.36));
  assert.equal(roundTo(valueOf(s), s.place), th(2850));
  assert.equal(valueOf({ neg: true, int: 2, frac: 500 }), -2500);
  assert.ok(Object.is(valueOf({ neg: true, int: 0, frac: 0 }), 0));
  assert.equal(valueOf({ neg: false, int: 1e9, frac: -5 }), 9999000);
  assert.deepEqual(partsOf(-2500), { neg: true, int: 2, frac: 500 });
  assert.deepEqual(partsOf(0), { neg: false, int: 0, frac: 0 });
  for (const m of [0, 1, -1, 999, 2847360, -MAX, MAX]) assert.equal(valueOf(partsOf(m)), m);
  assert.equal(placeOf(100).name, "hàng phần mười");
  assert.equal(placeOf(12345).unit, 10000);
});

test("estimating a sum and a product by rounding first", () => {
  const sum = estimate(4876, 2349, "add", 100);
  assert.deepEqual([sum.ra, sum.rb, sum.approx, sum.exact, sum.error, sum.bound], [4900, 2300, 7200, 7225, -25, 100]);
  const prod = estimate(48, 62, "mul", 10);
  assert.deepEqual([prod.ra, prod.rb, prod.approx, prod.exact, prod.error], [50, 60, 3000, 2976, 24]);
  // highest place of each number
  const lead = estimate(4876, 62, "mul", 0);
  assert.deepEqual([lead.ua, lead.ub, lead.ra, lead.rb, lead.approx], [1000, 10, 5000, 60, 300000]);
  assert.equal(leadingUnit(7), 1);
  assert.equal(leadingUnit(10), 10);
  assert.equal(leadingUnit(9999), 1000);
  assert.equal(estimate(7, 8, "mul", 0).error, 0);
  // a place larger than the number rounds it to 0
  assert.equal(estimate(30, 4000, "mul", 100).approx, 0);
});

test("the estimate is never further from the exact result than the bound", () => {
  const rand = rng(8);
  for (let i = 0; i < 5000; i++) {
    const a = 1 + Math.floor(rand() * 9999);
    const b = 1 + Math.floor(rand() * 9999);
    for (const place of E_PLACES)
      for (const op of ["add", "mul"]) {
        const e = estimate(a, b, op, place);
        assert.ok(Math.abs(e.ra - a) <= e.ua / 2 && Math.abs(e.rb - b) <= e.ub / 2);
        assert.ok(Math.abs(e.error) <= e.bound, `${a} ${op} ${b} at ${place}`);
        assert.equal(e.error, e.approx - e.exact);
        if (op === "add" && place) assert.ok(Math.abs(e.error) <= place);
      }
  }
  const forged = estimateOf({ ea: -5, eb: 1e9, eop: "pow", ePlace: 7 });
  assert.deepEqual([forged.exact, forged.ua], [1 + 9999, 100]);
});

test("practice questions lie strictly between two marks and have one right answer", () => {
  const rand = rng(12);
  let cur = {};
  const seen = { neg: 0, half: 0 };
  for (let i = 0; i < 2000; i++) {
    const raw = newQuestion(rand, cur);
    const { m, unit } = questionOf(raw);
    assert.deepEqual([m, unit], [raw.pm, raw.pUnit], "generated questions need no repair");
    const k = marks(m, unit);
    assert.ok(!k.onMark && Math.abs(m) <= MAX);
    assert.ok(isCorrect(m, unit, k.lo) !== isCorrect(m, unit, k.hi), "exactly one mark is right");
    assert.ok(raw.pm !== cur.pm || raw.pUnit !== cur.pUnit);
    if (m < 0) seen.neg++;
    if (k.toLo === k.toHi) seen.half++;
    cur = raw;
  }
  assert.ok(seen.neg > 50 && seen.half > 50, "negatives and exact halves do come up");
  // forged questions are repaired
  assert.ok(!marks(questionOf({ pm: 3000, pUnit: 1000 }).m, 1000).onMark);
  assert.ok(!marks(questionOf({ pm: 30, pUnit: 10 }).m, 10).onMark);
  assert.equal(questionOf({ pm: "x", pUnit: 77 }).unit, 10000);
});
