import test from "node:test";
import assert from "node:assert/strict";
import { initialState, dot, dotV, dotPolar, angle, projection, kind, len, snap } from "./model.js";

const near = (x, y, tol = 1e-9) => assert.ok(Math.abs(x - y) < tol, `${x} ≠ ${y}`);
const S = (ax, ay, bx, by) => ({ ...initialState(), ax, ay, bx, by });
const grid = [];
for (let i = -5; i <= 5; i += 2.5) for (let j = -5; j <= 5; j += 2.5) grid.push([i, j]);

test("a1b1 + a2b2 equals |a||b|cos θ for many pairs", () => {
  for (const [ax, ay] of grid) for (const [bx, by] of grid) near(dot(S(ax, ay, bx, by)), dotPolar(S(ax, ay, bx, by)), 1e-9);
  near(dot(S(4, 1, 2, 3)), 11);
  near(angle(S(1, 0, 1, 1)), 45);
  near(angle(S(1, 0, -1, 0)), 180);
});

test("perpendicular iff the product is 0, sign gives acute / right / obtuse", () => {
  assert.equal(kind(S(3, 1, -1, 3)), "right");
  near(angle(S(3, 1, -1, 3)), 90);
  assert.equal(kind(S(2, 0, 1, 4)), "acute");
  assert.equal(kind(S(2, 0, -1, 4)), "obtuse");
  for (const [ax, ay] of grid) for (const [bx, by] of grid) {
    const s = S(ax, ay, bx, by);
    if (kind(s) === "zero") continue;
    assert.equal(kind(s) === "right", Math.abs(angle(s) - 90) < 1e-9);
    assert.equal(kind(s) === "acute", angle(s) < 90 - 1e-9);
  }
});

test("projection of b on a has length |b|·|cos θ| = |a·b|/|a|", () => {
  const s = S(4, 0, 3, 5);
  near(projection(s).signed, 3);
  assert.deepEqual(projection(s).vector, [3, 0]);
  const o = S(1, 1, -3, 0);
  near(projection(o).signed, -3 / Math.SQRT2);
  near(projection(o).length, len([3, 0]) * Math.abs(Math.cos((angle(o) * Math.PI) / 180)));
  // b minus its projection is perpendicular to a
  const p = projection(S(2, 1, 1, 3)).vector;
  near(dotV([2, 1], [1 - p[0], 3 - p[1]]), 0);
});

test("a·a = |a|², commutativity, distributivity, scalar factor", () => {
  const a = [3, -2];
  const b = [1.5, 4];
  const c = [-2, 0.5];
  near(dotV(a, a), len(a) ** 2);
  near(dotV(a, b), dotV(b, a));
  near(dotV(a, [b[0] + c[0], b[1] + c[1]]), dotV(a, b) + dotV(a, c));
  near(dotV([2.5 * a[0], 2.5 * a[1]], b), 2.5 * dotV(a, b));
});

test("zero vectors: product 0, angle and projection undefined", () => {
  const z = S(0, 0, 2, 3);
  assert.equal(dot(z), 0);
  assert.equal(dotPolar(z), 0);
  assert.ok(Number.isNaN(angle(z)));
  assert.equal(projection(z), null);
  assert.equal(kind(z), "zero");
  assert.equal(kind(S(2, 3, 0, 0)), "zero");
  near(projection(S(2, 3, 0, 0)).length, 0);
});

test("snap keeps coordinates on the half-unit grid and in range", () => {
  assert.equal(snap(2.26), 2.5);
  assert.equal(snap(99), 5);
  assert.equal(snap(-7), -5);
});
