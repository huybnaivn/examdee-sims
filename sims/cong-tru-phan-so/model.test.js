import test from "node:test";
import assert from "node:assert/strict";
import { MAX, initialState, gcd, lcm, simplify, toImproper, toMixed, read, normalize, solve, shownStage, check, newProblem, mixedParts } from "./model.js";

const S = o => ({ ...initialState(), ...o });
const kinds = s => solve(s).steps.map(x => x.kind);

test("lowest common denominator is the lcm of the two denominators", () => {
  assert.equal(lcm(4, 6), 12);
  assert.equal(lcm(4, 12), 12);
  assert.equal(lcm(3, 5), 15);
  assert.equal(lcm(6, 10), 30);
  for (let a = 1; a <= MAX; a++)
    for (let b = 1; b <= MAX; b++) {
      const D = solve(S({ n1: 1, d1: a, n2: 1, d2: b })).D;
      assert.ok(D % a === 0 && D % b === 0, `${a}, ${b}`);
      for (let k = 1; k < D; k++) assert.ok(k % a || k % b, `${k} is a smaller common multiple of ${a}, ${b}`);
    }
});

test("addition and subtraction results are exact for every pair", () => {
  for (const op of ["+", "-"])
    for (let d1 = 1; d1 <= MAX; d1++)
      for (let d2 = 1; d2 <= MAX; d2++)
        for (const [n1, n2] of [[0, 0], [1, d2], [d1, 1], [Math.min(MAX, 7), 5]]) {
          const r = solve(S({ op, n1, d1, n2, d2, negative: true })).result;
          const want = op === "+" ? n1 / d1 + n2 / d2 : n1 / d1 - n2 / d2;
          assert.ok(Math.abs(r.n / r.d - want) < 1e-12, `${n1}/${d1} ${op} ${n2}/${d2}`);
          assert.equal(gcd(r.n, r.d), 1);
          assert.ok(r.d > 0);
        }
  assert.deepEqual(solve(S({ op: "+", n1: 3, d1: 4, n2: 1, d2: 6 })).result, { n: 11, d: 12 });
  assert.deepEqual(solve(S({ op: "-", n1: 5, d1: 6, n2: 1, d2: 3 })).result, { n: 1, d: 2 });
});

test("the written steps: common denominator, numerators, simplification by the gcd", () => {
  const r = solve(S({ op: "+", n1: 5, d1: 6, n2: 3, d2: 10 }));
  assert.equal(r.D, 30);
  assert.deepEqual([r.a2, r.b2, r.raw], [{ n: 25, d: 30 }, { n: 9, d: 30 }, { n: 34, d: 30 }]);
  assert.equal(r.g, 2);
  assert.deepEqual(r.result, { n: 17, d: 15 });
  assert.deepEqual(kinds(S({ op: "+", n1: 5, d1: 6, n2: 3, d2: 10 })), ["problem", "common", "compute", "simplify"]);
  // already in lowest terms: no simplify step
  assert.deepEqual(kinds(S({ op: "+", n1: 3, d1: 4, n2: 1, d2: 6 })), ["problem", "common", "compute"]);
});

test("simplification divides by the gcd", () => {
  assert.deepEqual(simplify({ n: 8, d: 12 }), { n: 2, d: 3 });
  assert.deepEqual(simplify({ n: -6, d: 4 }), { n: -3, d: 2 });
  assert.deepEqual(simplify({ n: 3, d: -9 }), { n: -1, d: 3 });
  assert.deepEqual(simplify({ n: 0, d: 7 }), { n: 0, d: 1 });
  const r = solve(S({ op: "+", n1: 1, d1: 4, n2: 5, d2: 12 }));
  assert.equal(r.g, 4);
  assert.deepEqual(r.result, { n: 2, d: 3 });
});

test("negative results (lớp 6) keep the sign on the numerator", () => {
  const blocked = solve(S({ op: "-", n1: 1, d1: 4, n2: 1, d2: 2, negative: false }));
  assert.equal(blocked.blocked, true);
  assert.equal(blocked.result, null);
  const r = solve(S({ op: "-", n1: 1, d1: 4, n2: 1, d2: 2, negative: true }));
  assert.deepEqual(r.result, { n: -1, d: 4 });
  const big = solve(S({ op: "-", n1: 1, d1: 6, n2: 5, d2: 3, negative: true, mixed: false }));
  assert.deepEqual(big.result, { n: -3, d: 2 });
  assert.deepEqual(mixedParts(big.result), ["−1", { n: 1, d: 2 }]);
  assert.deepEqual(toMixed({ n: -7, d: 4 }), { sign: -1, whole: 1, n: 3, d: 4 });
  // equal fractions subtract to 0 even in lớp 4–5
  assert.deepEqual(solve(S({ op: "-", n1: 2, d1: 4, n2: 1, d2: 2 })).result, { n: 0, d: 1 });
});

test("mixed numbers convert to fractions and back", () => {
  assert.deepEqual(toImproper(2, 3, 4), { n: 11, d: 4 });
  assert.deepEqual(toMixed({ n: 11, d: 4 }), { sign: 1, whole: 2, n: 3, d: 4 });
  assert.deepEqual(toMixed({ n: 8, d: 4 }), { sign: 1, whole: 2, n: 0, d: 1 });
  for (let w = 0; w <= 3; w++)
    for (let d = 1; d <= MAX; d++)
      for (let n = 0; n < d; n++) {
        const f = toImproper(w, n, d);
        const m = toMixed(f);
        assert.equal(m.whole + m.n / m.d, w + n / d);
      }
  const s = S({ mixed: true, w1: 1, n1: 3, d1: 4, w2: 2, n2: 1, d2: 6, op: "+" });
  const r = solve(s);
  assert.deepEqual([r.a, r.b], [{ n: 7, d: 4 }, { n: 13, d: 6 }]);
  assert.deepEqual(r.result, { n: 47, d: 12 });
  assert.deepEqual(kinds(s), ["problem", "convert", "common", "compute", "mixed"]);
  // fraction part of a mixed number is made proper
  const t = S({ mixed: true, n1: 9, d1: 4 });
  normalize(t);
  assert.equal(t.n1, 3);
  assert.equal(read(t).A.n, 3);
  // whole parts are ignored when mixed is off and in practice
  assert.deepEqual(read(S({ mixed: false, w1: 3 })).A.f, { n: 1, d: 4 });
  assert.deepEqual(read(S({ mixed: true, mode: "practice", w1: 3 })).A.f, { n: 1, d: 4 });
});

test("equal denominators skip the splitting step", () => {
  assert.deepEqual(kinds(S({ op: "+", n1: 2, d1: 7, n2: 3, d2: 7 })), ["problem", "compute"]);
  assert.deepEqual(kinds(S({ op: "+", n1: 1, d1: 6, n2: 3, d2: 6 })), ["problem", "compute", "simplify"]);
  assert.ok(!kinds(S({ d1: 5, d2: 5 })).includes("common"));
});

test("forged state is clamped", () => {
  const r = read({ ...initialState(), d1: 0, d2: -3, n1: 99, n2: "x", stage: -5 });
  assert.deepEqual([r.A.f, r.B.f], [{ n: 12, d: 1 }, { n: 0, d: 1 }]);
  assert.equal(shownStage({ ...initialState(), stage: 1e9 }), solve(initialState()).steps.length - 1);
  assert.equal(shownStage({ ...initialState(), stage: NaN }), 0);
});

test("checking the learner's answer", () => {
  const res = { n: 2, d: 3 };
  assert.equal(check("2", "3", res), "correct");
  assert.equal(check("8", "12", res), "unsimplified");
  assert.equal(check("3", "4", res), "wrong");
  assert.equal(check("2", "0", res), "invalid");
  assert.equal(check("", "3", res), "invalid");
  assert.equal(check("2", "", { n: 2, d: 1 }), "correct");
  assert.equal(check("−1", "4", { n: -1, d: 4 }), "correct");
  assert.equal(check("1", "-4", { n: -1, d: 4 }), "correct");
  assert.equal(check("0", "", { n: 0, d: 1 }), "correct");
});

test("practice problems are proper fractions; no negative result in lớp 4–5", () => {
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < 500; i++) {
    const p = newProblem(rand, false);
    assert.ok(p.n1 >= 1 && p.n1 < p.d1 && p.n2 >= 1 && p.n2 < p.d2 && p.d1 <= 10 && p.d2 <= 10);
    const r = solve(S({ ...p, mode: "practice" }));
    assert.ok(!r.blocked && r.result.n >= 0);
  }
});
