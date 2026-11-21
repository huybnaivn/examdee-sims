import test from "node:test";
import assert from "node:assert/strict";
import { QUANTITIES, KEYS, initialState, unitOptions, read, factor, convert, inputValue, format, placeDigits, parseAnswer, check, newQuestion, toNumber, colOf } from "./model.js";

const L = 0, M = 1, A = 2, T = 3;
const pow = (b, e) => (e >= 0 ? { p: BigInt(b) ** BigInt(e), q: 1n } : { p: 1n, q: BigInt(b) ** BigInt(-e) });
const ratio = f => Number(f.p) / Number(f.q);
const conv = (qi, from, to, num, dec = 0) => format(convert(qi, colOf(qi, from), colOf(qi, to), inputValue(num, dec)));

test("conversion factors for every pair of units (length, mass: ×10 per step)", () => {
  for (const qi of [L, M]) {
    const n = QUANTITIES[qi].units.length;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) assert.deepEqual(factor(qi, i, j), pow(10, j - i), `${QUANTITIES[qi].units[i]} → ${QUANTITIES[qi].units[j]}`);
  }
  assert.equal(conv(L, "km", "m", 1), "1000");
  assert.equal(conv(L, "m", "cm", 1), "100");
  assert.equal(conv(L, "km", "mm", 1), "1 000 000");
  assert.equal(conv(M, "tấn", "kg", 1), "1000");
  assert.equal(conv(M, "tạ", "kg", 1), "100");
  assert.equal(conv(M, "yến", "kg", 1), "10");
  assert.equal(conv(M, "kg", "g", 1), "1000");
  assert.equal(conv(M, "g", "tấn", 1), "0,000001");
});

test("area goes in steps of 100; ha is hm²", () => {
  const n = QUANTITIES[A].units.length;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) assert.deepEqual(factor(A, i, j), pow(100, j - i));
  assert.equal(conv(A, "m²", "dm²", 1), "100");
  assert.equal(conv(A, "ha", "m²", 1), "10 000");
  assert.equal(conv(A, "km²", "ha", 1), "100");
  assert.equal(conv(A, "hm²", "ha", 7), "7");
  assert.equal(conv(A, "m²", "cm²", 25, 1), "25 000");
  assert.equal(conv(A, "cm²", "m²", 50), "0,005");
  assert.equal(conv(A, "km²", "mm²", 1), "1 000 000 000 000");
  assert.ok(unitOptions(A).some(o => o.value === "ha" && o.col === 1));
});

test("time: ngày, giờ, phút, giây", () => {
  assert.equal(conv(T, "ngày", "giờ", 2), "48");
  assert.equal(conv(T, "giờ", "phút", 15, 1), "90");
  assert.equal(conv(T, "phút", "giây", 3), "180");
  assert.equal(conv(T, "ngày", "giây", 1), "86 400");
  assert.equal(conv(T, "phút", "giờ", 90), "1,5");
  assert.equal(conv(T, "phút", "giờ", 45), "0,75");
  assert.equal(conv(T, "giờ", "ngày", 6), "0,25");
  assert.equal(conv(T, "phút", "giờ", 20), "≈ 0,333");
  assert.equal(conv(T, "phút", "giờ", 1), "≈ 0,017");
  assert.equal(ratio(factor(T, 3, 0)), 1 / 86400);
});

test("decimal results are written with a comma", () => {
  assert.equal(conv(L, "m", "km", 375), "0,375");
  assert.equal(conv(L, "km", "m", 375, 2), "3750");
  assert.equal(conv(M, "g", "kg", 5), "0,005");
  assert.equal(conv(L, "cm", "m", 125, 1), "0,125");
  assert.equal(format({ p: 1n, q: 2n }), "0,5");
  assert.equal(format({ p: 2n, q: 3n }, 2), "≈ 0,67");
  assert.equal(format({ p: 12345n, q: 1n }), "12 345");
  assert.equal(format({ p: 1234n, q: 1n }), "1234");
  assert.ok(!conv(L, "dm", "km", 999, 2).includes("."));
});

test("round trips give the number back", () => {
  for (const qi of [L, M, A, T]) {
    const n = QUANTITIES[qi].units.length;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++)
        for (const [num, dec] of [[1, 0], [375, 2], [999, 1], [5, 2]]) {
          const v = inputValue(num, dec);
          const back = convert(qi, j, i, convert(qi, i, j, v));
          assert.equal(back.p * v.q, v.p * back.q, `${QUANTITIES[qi].units[i]} → ${QUANTITIES[qi].units[j]} → back`);
        }
  }
});

test("the place-value table reads the same number as the conversion", () => {
  const t = placeDigits(L, 0, 3, 375, 2); // 3,75 km → m
  assert.equal(t.text, "3750");
  assert.deepEqual(t.slots.map(x => x.digit).join(""), "3750");
  assert.deepEqual(t.slots.map(x => x.added), [false, false, false, true]);
  assert.equal(placeDigits(L, 3, 0, 375, 0).text, "0,375"); // 375 m → km
  assert.equal(placeDigits(L, 0, 3, 5, 1).text, "500"); // 0,5 km → m
  assert.equal(placeDigits(A, 1, 3, 2, 0).text, "20 000"); // 2 ha → m²
  for (const qi of [L, M, A]) {
    const n = QUANTITIES[qi].units.length;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++)
        for (const [num, dec] of [[1, 0], [375, 2], [999, 1], [5, 2], [120, 0], [40, 1]])
          assert.equal(placeDigits(qi, i, j, num, dec).text, format(convert(qi, i, j, inputValue(num, dec))), `${num}e-${dec} ${i}→${j}`);
  }
});

test("practice answers are checked exactly; comma or thousands dots", () => {
  const r = convert(L, 0, 3, inputValue(375, 2));
  assert.equal(check("3750", r), "correct");
  assert.equal(check("3 750", r), "correct");
  assert.equal(check("3.750", r), "correct");
  assert.equal(check("3750,0", r), "correct");
  assert.equal(check("375", r), "wrong");
  assert.equal(check("", r), "invalid");
  assert.equal(check("abc", r), "invalid");
  const s = convert(L, 3, 0, inputValue(375, 0));
  assert.equal(check("0,375", s), "correct");
  assert.equal(check("0.375", s), "wrong"); // a dot followed by three digits is a thousands separator in Vietnamese
  assert.equal(check("0,38", s), "wrong");
  assert.deepEqual(parseAnswer("1,5"), { p: 3n, q: 2n });
  assert.deepEqual(parseAnswer("1.5"), { p: 3n, q: 2n });
});

test("practice questions have exact, short answers", () => {
  let seed = 11;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  for (let qi = 0; qi < 4; qi++)
    for (let i = 0; i < 300; i++) {
      const q = newQuestion(rand, qi);
      const [kf, kt] = KEYS[qi];
      const r = read({ ...initialState(), qty: QUANTITIES[qi].key, [kf]: q.from, [kt]: q.to, num: q.num, dec: q.dec });
      assert.notEqual(r.from, r.to);
      const v = convert(qi, r.from, r.to, inputValue(r.num, r.dec));
      assert.ok(!format(v).startsWith("≈"));
      assert.equal(check(format(v), v), "correct");
      assert.ok(Number.isFinite(toNumber(v)));
    }
});

test("forged state falls back to safe values", () => {
  const r = read({ qty: "nope", num: -4, dec: 9, lenFrom: "parsec", lenTo: "m" });
  assert.deepEqual([r.qi, r.num, r.dec, r.from, r.to], [0, 1, 2, 0, 3]);
});
