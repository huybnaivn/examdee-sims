import test from "node:test";
import assert from "node:assert/strict";
import { RANGE, initialState, linear, quadratic, analyze, evaluate } from "./model.js";

const near = (x, y, eps = 1e-9) => assert.ok(Math.abs(x - y) < eps, `${x} ≠ ${y}`);
const coefficients = [];
for (let v = -RANGE; v <= RANGE; v += 0.5) coefficients.push(v);

test("quadratic roots match the formula in all three Δ cases", () => {
  // Δ > 0
  let r = quadratic(1, -2, -3);
  assert.equal(r.delta, 16);
  assert.deepEqual(r.roots, [-1, 3]);
  // Δ = 0
  r = quadratic(1, -4, 4);
  assert.equal(r.delta, 0);
  assert.deepEqual(r.roots, [2]);
  // Δ < 0
  r = quadratic(1, 0, 1);
  assert.equal(r.delta, -4);
  assert.deepEqual(r.roots, []);
  // negative a keeps the roots in ascending order
  assert.deepEqual(quadratic(-1, 0, 4).roots, [-2, 2]);

  for (const a of coefficients)
    for (const b of coefficients)
      for (const c of coefficients) {
        if (a === 0) continue;
        const q = quadratic(a, b, c);
        const delta = b * b - 4 * a * c;
        assert.equal(q.delta, delta);
        assert.equal(q.roots.length, delta > 0 ? 2 : delta === 0 ? 1 : 0);
        const expected = delta < 0 ? [] : delta === 0 ? [-b / (2 * a)] : [(-b - Math.sqrt(delta)) / (2 * a), (-b + Math.sqrt(delta)) / (2 * a)].sort((p, q) => p - q);
        q.roots.forEach((x, i) => {
          near(x, expected[i]);
          near(evaluate({ kind: "quadratic", a, b, c }, x), 0, 1e-9);
        });
      }
});

test("vertex is (−b/2a, −Δ/4a) and lies on the curve", () => {
  assert.deepEqual(quadratic(1, -2, -3).vertex, { x: 1, y: -4 });
  assert.deepEqual(quadratic(-2, 4, 1).vertex, { x: 1, y: 3 });
  for (const a of coefficients)
    for (const b of coefficients)
      for (const c of coefficients) {
        if (a === 0) continue;
        const { vertex, delta } = quadratic(a, b, c);
        near(vertex.x, -b / (2 * a));
        near(vertex.y, -delta / (4 * a));
        near(evaluate({ kind: "quadratic", a, b, c }, vertex.x), vertex.y);
        // symmetric about x = vertex.x
        near(evaluate({ kind: "quadratic", a, b, c }, vertex.x - 1.5), evaluate({ kind: "quadratic", a, b, c }, vertex.x + 1.5));
      }
});

test("linear root is −b/a; none when a = 0 and b ≠ 0", () => {
  assert.deepEqual(linear(2, -3).roots, [1.5]);
  assert.deepEqual(linear(-0.5, 2).roots, [4]);
  assert.ok(Object.is(linear(2, 0).roots[0], 0), "root is 0, not −0");
  const flat = linear(0, 3);
  assert.deepEqual(flat.roots, []);
  assert.equal(flat.allReal, false);
  assert.equal(flat.type, "constant");
  // y = 0: every x is a root
  assert.equal(linear(0, 0).allReal, true);
  assert.equal(linear(2, -3).yIntercept, -3);
});

test("a = 0 in the quadratic degrades cleanly to a line", () => {
  const r = quadratic(0, 2, -4);
  assert.equal(r.type, "linear");
  assert.equal(r.degenerate, true);
  assert.deepEqual(r.roots, [2]);
  assert.equal(r.slope, 2);
  assert.equal(r.yIntercept, -4);
  assert.equal(r.vertex, null);
  assert.equal(r.delta, null);
  for (const v of Object.values(r)) assert.ok(!Number.isNaN(v) && v !== Infinity && v !== -Infinity);
  // a = b = 0: constant
  assert.deepEqual(quadratic(0, 0, 3).roots, []);
  assert.equal(quadratic(0, 0, 3).type, "constant");
  assert.equal(quadratic(0, 0, 0).allReal, true);
  assert.equal(evaluate({ kind: "quadratic", a: 0, b: 2, c: -4 }, 3), 2);
});

test("analyze follows the selected kind", () => {
  const s = initialState();
  assert.equal(analyze(s).type, "quadratic");
  assert.equal(analyze(s).yIntercept, s.c);
  const line = analyze({ ...s, kind: "linear" }); // y = x − 2, c ignored
  assert.deepEqual(line.roots, [2]);
  assert.equal(line.yIntercept, -2);
  assert.equal(evaluate({ ...s, kind: "linear" }, 5), 3);
});
