import test from "node:test";
import assert from "node:assert/strict";
import { INEQ, TYPES, initialState, f, analyze, solutionSet, contains, newProblem } from "./model.js";

const holds = (y, ineq) => (ineq === "gt" ? y > 0 : ineq === "ge" ? y >= 0 : ineq === "lt" ? y < 0 : y <= 0);
const types = (a, b, c) => INEQ.map(i => solutionSet(a, b, c, i).type);
// one sample inside each interval of the sign table
const samples = roots => (roots.length ? [roots[0] - 1, ...roots.slice(1).map((r, i) => (r + roots[i]) / 2), roots.at(-1) + 1] : [0]);

test("Δ > 0: opposite to a between the roots, same sign as a outside (trong trái, ngoài cùng)", () => {
  const up = analyze(1, -1, -2); // roots −1 and 2
  assert.equal(up.delta, 9);
  assert.deepEqual(up.roots, [-1, 2]);
  assert.deepEqual(up.signs, [1, -1, 1]);
  const down = analyze(-2, 2, 4); // same roots, a < 0
  assert.deepEqual(down.roots, [-1, 2]);
  assert.deepEqual(down.signs, [-1, 1, -1]);
});

test("Δ = 0: sign of a everywhere except the double root; Δ < 0: sign of a everywhere", () => {
  assert.deepEqual(analyze(1, -4, 4), { degree: 2, delta: 0, roots: [2], signs: [1, 1] });
  assert.deepEqual(analyze(-1, 4, -4), { degree: 2, delta: 0, roots: [2], signs: [-1, -1] });
  assert.deepEqual(analyze(1, 2, 5), { degree: 2, delta: -16, roots: [], signs: [1] });
  assert.deepEqual(analyze(-3, 1, -1), { degree: 2, delta: -11, roots: [], signs: [-1] });
});

test("the sign table matches sample values of f on every interval", () => {
  for (let a = -4; a <= 4; a++) for (let b = -7; b <= 7; b++) for (let c = -7; c <= 7; c++) {
    const t = analyze(a, b, c);
    assert.equal(t.signs.length, t.roots.length + 1);
    samples(t.roots).forEach((x, i) => assert.equal(Math.sign(f(a, b, c, x)), t.signs[i], `a=${a} b=${b} c=${c} x=${x}`));
    for (const r of t.roots) assert.ok(Math.abs(f(a, b, c, r)) < 1e-9);
  }
});

test("solution sets, Δ > 0 and a > 0: outside for > and ≥, between for < and ≤", () => {
  assert.deepEqual(types(1, -1, -2), ["outside", "outsideClosed", "between", "betweenClosed"]);
  assert.deepEqual(solutionSet(1, -1, -2, "gt").intervals, [
    { lo: -Infinity, hi: -1, loClosed: false, hiClosed: false },
    { lo: 2, hi: Infinity, loClosed: false, hiClosed: false },
  ]);
  assert.deepEqual(solutionSet(1, -1, -2, "le").intervals, [{ lo: -1, hi: 2, loClosed: true, hiClosed: true }]);
});

test("solution sets, Δ > 0 and a < 0: the other way round", () => {
  assert.deepEqual(types(-1, 1, 2), ["between", "betweenClosed", "outside", "outsideClosed"]);
  assert.deepEqual(solutionSet(-1, 1, 2, "ge").intervals, [{ lo: -1, hi: 2, loClosed: true, hiClosed: true }]);
});

test("solution sets, Δ = 0: ℝ \\ {x₀}, ℝ, ∅ and the single point {x₀}", () => {
  assert.deepEqual(types(1, -4, 4), ["allExcept", "all", "empty", "point"]);
  assert.deepEqual(types(-1, 4, -4), ["empty", "point", "allExcept", "all"]);
  assert.deepEqual(solutionSet(1, -4, 4, "le").intervals, [{ lo: 2, hi: 2, loClosed: true, hiClosed: true }]);
  assert.deepEqual(solutionSet(1, -4, 4, "gt").intervals, [
    { lo: -Infinity, hi: 2, loClosed: false, hiClosed: false },
    { lo: 2, hi: Infinity, loClosed: false, hiClosed: false },
  ]);
  assert.deepEqual(solutionSet(1, -4, 4, "ge").intervals, [{ lo: -Infinity, hi: Infinity, loClosed: false, hiClosed: false }]);
});

test("solution sets, Δ < 0: ℝ or ∅", () => {
  assert.deepEqual(types(1, 2, 5), ["all", "all", "empty", "empty"]);
  assert.deepEqual(types(-1, 2, -5), ["empty", "empty", "all", "all"]);
});

test("endpoints belong to the set only for ≥ and ≤; membership agrees with f(x) everywhere", () => {
  for (let a = -3; a <= 3; a++) for (let b = -6; b <= 6; b++) for (let c = -6; c <= 6; c++) {
    const { roots } = analyze(a, b, c);
    for (const ineq of INEQ) {
      const { intervals, type } = solutionSet(a, b, c, ineq);
      assert.ok(TYPES.includes(type));
      for (const r of roots) assert.equal(contains(intervals, r), ineq === "ge" || ineq === "le");
      for (const x of samples(roots)) assert.equal(contains(intervals, x), holds(f(a, b, c, x), ineq), `a=${a} b=${b} c=${c} ${ineq} x=${x}`);
      // far out on both sides
      for (const x of [-1e6, 1e6]) assert.equal(contains(intervals, x), holds(f(a, b, c, x), ineq));
      // intervals are in order and do not overlap
      intervals.forEach((iv, i) => {
        assert.ok(iv.lo <= iv.hi);
        if (i) assert.ok(intervals[i - 1].hi <= iv.lo);
      });
    }
  }
});

test("a = 0 falls back to a first-degree or constant expression", () => {
  assert.deepEqual(analyze(0, 2, -4), { degree: 1, roots: [2], signs: [-1, 1] });
  assert.deepEqual(types(0, 2, -4), ["right", "rightClosed", "left", "leftClosed"]);
  assert.deepEqual(types(0, -2, 4), ["left", "leftClosed", "right", "rightClosed"]);
  assert.deepEqual(types(0, 0, 3), ["all", "all", "empty", "empty"]);
  assert.deepEqual(types(0, 0, 0), ["empty", "all", "empty", "all"]); // f ≡ 0
});

test("generated exercises are real quadratics within the control ranges", () => {
  let seed = 11;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const seen = new Set();
  for (let i = 0; i < 400; i++) {
    const p = newProblem(rand);
    assert.ok(p.a !== 0 && Math.abs(p.a) <= 5 && Math.abs(p.b) <= 12 && Math.abs(p.c) <= 18);
    assert.ok([p.a, p.b, p.c].every(Number.isInteger) && INEQ.includes(p.ineq));
    const type = solutionSet(p.a, p.b, p.c, p.ineq).type;
    assert.ok(TYPES.indexOf(type) < 8); // one of the eight choices offered in practice
    seen.add(type);
  }
  assert.equal(seen.size, 8);
  const s = initialState();
  assert.equal(solutionSet(s.a, s.b, s.c, s.ineq).type, "outside");
});
