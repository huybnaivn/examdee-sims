import test from "node:test";
import assert from "node:assert/strict";
import { PLACES, MAX, initialState, value, digits, regroup, valueB, format, readInt, words, compare, firstDifference, round, decimalsFor, newTarget, sanitize } from "./model.js";

const blocks = (th, h, t, u, d, c) => ({ th, h, t, u, d, c });

test("value from block counts, in hundredths", () => {
  assert.equal(value(initialState()), 123405);
  assert.equal(format(value(initialState())), "1234,05");
  assert.equal(value(blocks(0, 0, 0, 0, 5, 0)), 50);
  assert.equal(format(50), "0,5");
  assert.equal(value(blocks(0, 0, 0, 0, 0, 7)), 7);
  assert.equal(format(7), "0,07");
  assert.equal(value(blocks(9, 9, 9, 9, 9, 9)), MAX);
  assert.equal(format(MAX), "9999,99");
  assert.equal(format(300), "3");
  // one block of each place is worth its unit; ten of a place equal one of the place above
  for (let i = 1; i < PLACES.length; i++) assert.equal(10 * PLACES[i].unit, PLACES[i - 1].unit);
  for (let v = 0; v <= MAX; v += 997) assert.equal(value(digits(v)), v);
});

test("regrouping ten blocks keeps the value", () => {
  const r = regroup(blocks(0, 0, 0, 3, 10, 0));
  assert.deepEqual(r.counts, blocks(0, 0, 0, 4, 0, 0));
  assert.deepEqual(r.into, ["u"]);
  // cascade: 9,99 + 0,01 = 10
  const s = blocks(0, 0, 0, 9, 9, 10);
  const c = regroup(s);
  assert.deepEqual(c.counts, blocks(0, 0, 1, 0, 0, 0));
  assert.deepEqual(c.into, ["d", "u", "t"]);
  assert.equal(value(c.counts), value(s));
  for (let k = 0; k < 2000; k++) {
    const b = Object.fromEntries(PLACES.map(p => [p.key, (k * (p.unit % 7 + 3)) % 11]));
    const { counts } = regroup(b);
    assert.equal(value(counts), value(b));
    for (const p of PLACES.slice(1)) assert.ok(counts[p.key] <= 9);
  }
});

test("reading whole numbers in words", () => {
  const cases = {
    0: "không",
    5: "năm",
    10: "mười",
    11: "mười một",
    15: "mười lăm",
    21: "hai mươi mốt",
    25: "hai mươi lăm",
    34: "ba mươi bốn",
    100: "một trăm",
    105: "một trăm linh năm",
    110: "một trăm mười",
    251: "hai trăm năm mươi mốt",
    1000: "một nghìn",
    1005: "một nghìn không trăm linh năm",
    1050: "một nghìn không trăm năm mươi",
    1234: "một nghìn hai trăm ba mươi bốn",
    2015: "hai nghìn không trăm mười lăm",
    9999: "chín nghìn chín trăm chín mươi chín",
  };
  for (const [n, w] of Object.entries(cases)) assert.equal(readInt(Number(n)), w, n);
});

test("reading decimals: phẩy, không năm", () => {
  assert.equal(words(5), "không phẩy không năm"); // 0,05
  assert.equal(words(50), "không phẩy năm"); // 0,5
  assert.equal(words(45), "không phẩy bốn mươi lăm"); // 0,45
  assert.equal(words(1215), "mười hai phẩy mười lăm"); // 12,15
  assert.equal(words(321), "ba phẩy hai mươi mốt"); // 3,21
  assert.equal(words(123405), "một nghìn hai trăm ba mươi bốn phẩy không năm");
  assert.equal(words(700), "bảy");
});

test("comparing decimals with different numbers of digits", () => {
  assert.equal(compare(50, 45), 1); // 0,5 > 0,45
  assert.equal(compare(50, 50), 0); // 0,5 = 0,50
  assert.equal(compare(109, 110), -1); // 1,09 < 1,1
  assert.equal(compare(1000, 999), 1); // 10 > 9,99
  assert.equal(firstDifference(50, 45), 4); // decided at the tenths
  assert.equal(firstDifference(123405, 123450), 4);
  assert.equal(firstDifference(77, 77), -1);
  assert.equal(valueB({ bInt: 0, bD: 4, bC: 5 }), 45);
  for (let a = 0; a < 3000; a += 37) for (let b = 0; b < 3000; b += 41) {
    assert.equal(compare(a, b), Math.sign(a / 100 - b / 100));
    const i = firstDifference(a, b);
    if (i >= 0) assert.equal(compare(a, b), Math.sign(digits(a)[PLACES[i].key] - digits(b)[PLACES[i].key]));
  }
});

test("rounding to a chosen place, half up", () => {
  assert.equal(format(round(123405, 10), decimalsFor(10)), "1234,1"); // to tenths
  assert.equal(format(round(123405, 100), decimalsFor(100)), "1234");
  assert.equal(format(round(123405, 1000), 0), "1230");
  assert.equal(format(round(123405, 10000), 0), "1200");
  assert.equal(format(round(1204, 10), 1), "12,0");
  assert.equal(round(245, 100), 200); // 2,45 → 2
  assert.equal(round(250, 100), 300); // 2,5 → 3
  assert.equal(round(95, 10), 100); // 0,95 → 1,0
  assert.equal(round(999950, 100), 1000000); // 9999,5 → 10000
  for (const unit of [10, 100, 1000, 10000])
    for (let v = 0; v <= 20000; v += 13) {
      const r = round(v, unit);
      assert.equal(r % unit, 0);
      assert.ok(Math.abs(r - v) <= unit / 2);
      assert.equal(r, Math.round(v / unit) * unit); // same as round-half-up for positive numbers
    }
});

test("forged state is regrouped, capped and kept whole", () => {
  const s = sanitize({ th: 9, h: 10, t: 10, u: -3, d: 2.4, c: "x", target: 1e12, mode: 7 }, initialState());
  for (const p of PLACES) assert.ok(Number.isInteger(s[p.key]) && s[p.key] >= 0 && s[p.key] <= 9);
  assert.ok(value(s) <= MAX);
  assert.equal(s.target, MAX);
  assert.equal(s.mode, "build");
  const t = sanitize({ u: 10, d: 10 }, initialState());
  assert.equal(value(t), value(initialState()) - 400 - 0 + 1000 + 100); // 10 units and 10 tenths replace 4 units and 0 tenths
});

test("new targets are in range and change", () => {
  let x = 0.1;
  const rand = () => (x = (x * 7919 + 0.123) % 1);
  let t = 1234;
  for (let i = 0; i < 200; i++) {
    const n = newTarget(rand, t);
    assert.ok(n >= 1 && n <= 9999 && n !== t);
    t = n;
  }
});
