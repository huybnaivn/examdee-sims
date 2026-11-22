import test from "node:test";
import assert from "node:assert/strict";
import { initialState, solve, deltaPrime, rootsByDeltaPrime, viete, quickRoots, twoNumbers, isMatch, newProblem, equation } from "./model.js";

const near = (x, y, eps = 1e-9) => assert.ok(Math.abs(x - y) < eps, `${x} ≠ ${y}`);
const f = (a, b, c, x) => a * x * x + b * x + c;
const R = [-9, -4, -3, -2, -1, 0, 1, 2, 3, 5, 9];

test("Δ > 0: two distinct roots, x₁ with +√Δ and x₂ with −√Δ", () => {
  const r = solve(1, -2, -3);
  assert.equal(r.delta, 16);
  assert.deepEqual(r.roots, [3, -1]);
  assert.equal(r.rootCount, 2);
  const s = solve(2, 3, -4); // Δ = 41, irrational
  assert.equal(s.delta, 41);
  near(s.roots[0], (-3 + Math.sqrt(41)) / 4);
  near(s.roots[1], (-3 - Math.sqrt(41)) / 4);
});

test("Δ = 0: one double root −b/(2a); Δ < 0: no real root", () => {
  const r = solve(1, -4, 4);
  assert.equal(r.delta, 0);
  assert.deepEqual(r.roots, [2]);
  assert.equal(r.rootCount, 1);
  const s = solve(1, 2, 5);
  assert.equal(s.delta, -16);
  assert.deepEqual(s.roots, []);
  assert.equal(s.rootCount, 0);
});

test("every root found satisfies the equation, for all whole coefficients tried", () => {
  for (const a of R) for (const b of R) for (const c of R) {
    const r = solve(a, b, c);
    for (const x of r.roots) near(f(a, b, c, x), 0, 1e-8);
    if (a !== 0) assert.equal(r.rootCount, r.delta > 0 ? 2 : r.delta === 0 ? 1 : 0);
  }
});

test("Δ′ = b′² − ac = Δ/4 and the reduced formula gives the same roots", () => {
  assert.equal(deltaPrime(1, -2, -3), 4);
  assert.equal(deltaPrime(3, 8, 4), 16 - 12);
  for (const a of R) for (const b of R) for (const c of R) {
    if (a === 0) continue;
    const r = solve(a, b, c);
    assert.equal(deltaPrime(a, b, c) * 4, r.delta);
    const viaPrime = rootsByDeltaPrime(a, b, c);
    assert.equal(viaPrime.length, r.roots.length);
    viaPrime.forEach((x, i) => near(x, r.roots[i]));
  }
});

test("Viète: x₁ + x₂ = −b/a and x₁·x₂ = c/a whenever Δ ≥ 0", () => {
  assert.deepEqual(viete(1, -2, -3), { sum: 2, product: -3 });
  assert.deepEqual(viete(2, 5, -3), { sum: -2.5, product: -1.5 });
  for (const a of R) for (const b of R) for (const c of R) {
    const r = solve(a, b, c);
    const vt = viete(a, b, c);
    if (a === 0 || r.delta < 0) {
      assert.equal(vt, null);
      continue;
    }
    const [x1, x2 = x1] = r.roots; // a double root counts twice
    near(x1 + x2, vt.sum, 1e-8);
    near(x1 * x2, vt.product, 1e-8);
  }
});

test("quick roots: a + b + c = 0 gives 1 and c/a; a − b + c = 0 gives −1 and −c/a", () => {
  assert.deepEqual(quickRoots(2, -5, 3), { rule: "plus", roots: [1, 1.5] });
  assert.deepEqual(quickRoots(1, -2, -3), { rule: "minus", roots: [-1, 3] });
  assert.equal(quickRoots(1, 1, 1), null);
  assert.equal(quickRoots(0, 2, -2), null); // not a quadratic
  for (const a of R) for (const b of R) for (const c of R) {
    const q = quickRoots(a, b, c);
    if (!q) continue;
    for (const x of q.roots) near(f(a, b, c, x), 0);
    assert.deepEqual([...q.roots].sort((x, y) => x - y), [...solve(a, b, c).roots, ...solve(a, b, c).roots].slice(0, 2).sort((x, y) => x - y));
  }
});

test("reverse problem: solvable exactly when S² − 4P ≥ 0, and the numbers check out", () => {
  assert.deepEqual(twoNumbers(5, 6), [3, 2]);
  assert.deepEqual(twoNumbers(4, 4), [2, 2]);
  assert.equal(twoNumbers(2, 5), null);
  for (let S = -12; S <= 12; S++) for (let P = -36; P <= 36; P++) {
    const t = twoNumbers(S, P);
    assert.equal(t !== null, S * S - 4 * P >= 0);
    if (!t) continue;
    near(t[0] + t[1], S);
    near(t[0] * t[1], P, 1e-8);
    // they are the roots of X² − SX + P = 0
    for (const x of t) near(x * x - S * x + P, 0, 1e-8);
  }
});

test("a = 0 is handled as a linear equation", () => {
  assert.deepEqual(solve(0, 2, -6), { type: "linear", roots: [3], rootCount: 1 });
  assert.deepEqual(solve(0, 4, 0).roots, [0]); // never −0
  assert.ok(Object.is(solve(0, 4, 0).roots[0], 0));
  assert.deepEqual(solve(0, 0, 5), { type: "constant", roots: [], rootCount: 0 });
  assert.deepEqual(solve(0, 0, 0), { type: "constant", roots: [], rootCount: -1 });
  assert.equal(viete(0, 2, -6), null);
});

test("learner's answer and generated problems", () => {
  const s = initialState();
  assert.equal(isMatch(s), false);
  assert.equal(isMatch({ ...s, u: 2, v: 3 }), true);
  assert.equal(isMatch({ ...s, u: 3, v: 2 }), true);
  assert.equal(isMatch({ ...s, u: 1, v: 4 }), false); // right sum, wrong product
  assert.equal(isMatch({ ...s, u: 1, v: 6 }), false); // right product, wrong sum
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < 200; i++) {
    const p = newProblem(rand);
    const t = twoNumbers(p.sum, p.product);
    assert.ok(t && t.every(Number.isInteger) && t.every(x => Math.abs(x) <= 6));
    assert.ok(Math.abs(p.sum) <= 12 && Math.abs(p.product) <= 36);
  }
  assert.deepEqual(equation({ ...s, mode: "reverse" }), { a: 1, b: -5, c: 6 });
  assert.deepEqual(equation(s), { a: 1, b: -2, c: -3 });
});
