import test from "node:test";
import assert from "node:assert/strict";
import { initialState, settings, factorial, arrangements, combinations, typeCode, count, enumerate, firstArrangements, big, formula } from "./model.js";

const st = (n, k, ordered, repeat) => ({ ...initialState(), n, k, ordered, repeat });
const flat = pieces => pieces.map(p => (typeof p === "string" ? p : `${p.b}[${p.sub ?? ""}|${p.sup ?? ""}]`)).join("");

test("P_n = n!", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 10].map(n => count(st(n, n, true, false))), [1n, 2n, 6n, 24n, 120n, 720n, 3628800n]);
  assert.equal(typeCode(st(5, 5, true, false)), 1);
});

test("A_n^k = n!/(n − k)!", () => {
  for (let n = 1; n <= 20; n++) for (let k = 1; k <= n; k++) assert.equal(arrangements(n, k), factorial(n) / factorial(n - k));
  assert.equal(count(st(7, 3, true, false)), 210n);
  assert.equal(typeCode(st(7, 3, true, false)), 2);
});

test("C_n^k = n!/(k!(n − k)!)", () => {
  for (let n = 1; n <= 20; n++) for (let k = 0; k <= n; k++) assert.equal(combinations(n, k), factorial(n) / (factorial(k) * factorial(n - k)));
  assert.equal(count(st(7, 3, false, false)), 35n);
  assert.equal(count(st(10, 5, false, false)), 252n);
  assert.equal(typeCode(st(7, 7, false, false)), 3);
});

test("with repetition: n^k ordered, C(n + k − 1, k) unordered", () => {
  assert.equal(count(st(3, 4, true, true)), 81n);
  assert.equal(count(st(10, 3, true, true)), 1000n);
  assert.equal(count(st(3, 2, false, true)), 6n); // AA AB AC BB BC CC
  assert.equal(count(st(5, 3, false, true)), combinations(7, 3));
  assert.equal(typeCode(st(3, 4, true, true)), 4);
  assert.equal(typeCode(st(3, 4, false, true)), 5);
});

test("C_n^k = C_n^(n−k) and Pascal's rule C_n^k = C_(n−1)^(k−1) + C_(n−1)^k", () => {
  for (let n = 1; n <= 25; n++) {
    for (let k = 0; k <= n; k++) {
      assert.equal(combinations(n, k), combinations(n, n - k));
      if (k >= 1 && n >= 2) assert.equal(combinations(n, k), combinations(n - 1, k - 1) + combinations(n - 1, k));
    }
  }
  assert.equal(combinations(5, 0), 1n);
  assert.equal(combinations(5, 6), 0n);
});

test("full enumeration has exactly as many items as the formula, all distinct and valid", () => {
  for (let n = 1; n <= 6; n++) {
    for (let k = 1; k <= 6; k++) {
      for (const ordered of [true, false]) {
        for (const repeat of [true, false]) {
          if (!repeat && k > n) continue;
          const s = st(n, k, ordered, repeat);
          const all = [...enumerate(s)];
          assert.equal(BigInt(all.length), count(s), JSON.stringify(s));
          const keys = new Set(all.map(a => (ordered ? a : [...a].sort((x, y) => x - y)).join(",")));
          assert.equal(keys.size, all.length, "no arrangement twice");
          for (const a of all) {
            assert.equal(a.length, k);
            assert.ok(a.every(i => i >= 0 && i < n));
            if (!repeat) assert.equal(new Set(a).size, k);
          }
        }
      }
    }
  }
});

test("enumeration stops at the display cap without building the whole list", () => {
  const s = st(20, 20, true, false); // 20! ≈ 2,4 · 10^18 arrangements
  const few = firstArrangements(s, 30);
  assert.equal(few.length, 30);
  assert.deepEqual(few[0], [...Array(20).keys()]);
  assert.equal(firstArrangements(st(3, 2, false, false), 100).length, 3);
});

test("large values are exact", () => {
  assert.equal(count(st(20, 20, true, false)), 2432902008176640000n);
  assert.equal(big(count(st(20, 20, true, false))), "2.432.902.008.176.640.000");
  assert.equal(count(st(20, 20, true, true)), 104857600000000000000000000n); // 20^20
  assert.equal(count(st(20, 20, false, true)), 68923264410n); // C(39, 20)
  assert.equal(count(st(20, 10, false, false)), 184756n);
  assert.equal(big(5040n), "5.040");
  assert.equal(big(999n), "999");
});

test("settings clamp forged or out-of-range state; k ≤ n without repetition", () => {
  assert.deepEqual(settings({ n: 4, k: 9, ordered: true, repeat: false }), { n: 4, k: 4, ordered: true, repeat: false });
  assert.deepEqual(settings({ n: 4, k: 9, ordered: true, repeat: true }), { n: 4, k: 9, ordered: true, repeat: true });
  assert.deepEqual(settings({ n: -3, k: 1e9, ordered: 1, repeat: true }), { n: 1, k: 20, ordered: true, repeat: true });
  assert.deepEqual(settings({ n: NaN, k: 0 }), { n: 1, k: 1, ordered: false, repeat: false });
});

test("the formula on screen ends with the exact count", () => {
  assert.equal(flat(formula(st(7, 3, true, false))[1]), "A[7|3] = 7! / 4! = 7 · 6 · 5 = 210");
  assert.equal(flat(formula(st(7, 3, false, false))[1]), "C[7|3] = 7! / (3! · 4!) = 35");
  assert.equal(flat(formula(st(4, 4, true, false))[1]), "P[4|] = 4! = 4 · 3 · 2 · 1 = 24");
  assert.equal(flat(formula(st(10, 10, true, false))[1]), "P[10|] = 10! = 10 · 9 · … · 1 = 3.628.800");
  assert.equal(flat(formula(st(3, 4, true, true))[1]), "3[|4] = 81");
  assert.equal(flat(formula(st(5, 3, false, true))[1]), "C[5 + 3 − 1|3] = C[7|3] = 35");
  for (const s of [st(6, 2, true, false), st(9, 4, false, false), st(6, 6, true, false), st(4, 5, true, true), st(4, 5, false, true)]) {
    assert.ok(flat(formula(s)[1]).endsWith(`= ${big(count(s))}`));
  }
});
