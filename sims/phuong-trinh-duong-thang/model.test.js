import test from "node:test";
import assert from "node:assert/strict";
import {
  initialState, normalize, fromPointNormal, fromPointDirection, fromTwoPoints, line1, line2, slopeForm, at, value,
  distance, foot, angleBetween, relation, generalText, parametricText, slopeText,
} from "./model.js";

const near = (x, y, tol = 1e-9) => assert.ok(Math.abs(x - y) < tol, `${x} ≠ ${y}`);

test("two points → general form; both points satisfy it", () => {
  const l = fromTwoPoints([1, 2], [3, 5]);
  assert.deepEqual([l.a, l.b, l.c], [3, -2, 1]);
  assert.equal(generalText(l), "3x − 2y + 1 = 0");
  near(value(l, [1, 2]), 0);
  near(value(l, [3, 5]), 0);
  assert.deepEqual(normalize(-6, 4, -2), [3, -2, 1]);
  assert.deepEqual(normalize(0.5, 1.5, -1), [1, 3, -2]);
});

test("parametric, general and slope forms describe the same line", () => {
  for (const l of [fromPointDirection([-1, 2], [2, -1]), fromPointNormal([0.5, -3], [1, 4]), fromTwoPoints([-3, -1], [3, 2])]) {
    for (const t of [-2, 0, 1.5, 3]) near(value(l, at(l, t)), 0);
    near(l.a * l.u[0] + l.b * l.u[1], 0); // n ⊥ u
    const f = slopeForm(l);
    for (const x of [-2, 0, 4]) near(value(l, [x, f.k * x + f.m]), 0);
  }
  const d = fromPointDirection([-1, 2], [2, -1]);
  assert.deepEqual(parametricText(d), ["x = −1 + 2t", "y = 2 − t"]);
  assert.equal(slopeText(fromTwoPoints([0, 1], [2, 4])), "y = 1,5x + 1");
});

test("vertical and horizontal lines: no slope for x = const", () => {
  const v = fromTwoPoints([2, -1], [2, 5]);
  assert.equal(slopeForm(v), null);
  assert.equal(generalText(v), "x − 2 = 0");
  assert.equal(slopeText(v), "x = 2");
  const h = fromPointNormal([4, -3], [0, 2]);
  assert.equal(generalText(h), "y + 3 = 0");
  near(slopeForm(h).k, 0);
});

test("degenerate input gives no line", () => {
  assert.equal(fromTwoPoints([1, 1], [1, 1]), null);
  assert.equal(fromPointDirection([1, 1], [0, 0]), null);
  assert.equal(fromPointNormal([1, 1], [0, 0]), null);
});

test("parallel and coincident lines are told apart", () => {
  const l = fromTwoPoints([0, 0], [2, 1]);
  assert.equal(relation(l, fromTwoPoints([0, 1], [4, 3])).kind, "parallel");
  assert.equal(relation(l, fromTwoPoints([-2, -1], [4, 2])).kind, "coincident");
  assert.equal(relation(fromTwoPoints([1, -3], [1, 3]), fromTwoPoints([-2, 0], [-2, 5])).kind, "parallel");
  assert.equal(relation(l, fromTwoPoints([0, 0], [1, 3])).kind, "intersect");
});

test("intersection by Cramer's rule lies on both lines", () => {
  const l1 = fromTwoPoints([-3, -1], [3, 2]);
  const l2 = fromTwoPoints([-2, 4], [2, -2]);
  const r = relation(l1, l2);
  near(value(l1, r.point), 0);
  near(value(l2, r.point), 0);
  // x + y − 3 = 0 and x − y − 1 = 0 meet at (2; 1)
  const p = relation(fromPointNormal([3, 0], [1, 1]), fromPointNormal([1, 0], [1, -1]));
  near(p.point[0], 2);
  near(p.point[1], 1);
  assert.equal(p.perpendicular, true);
});

test("angle between lines from normal vectors", () => {
  near(angleBetween(fromPointNormal([0, 0], [1, 0]), fromPointNormal([0, 0], [1, 1])), 45);
  near(angleBetween(fromPointNormal([0, 0], [1, 2]), fromPointNormal([0, 0], [-2, 1])), 90);
  near(angleBetween(fromPointNormal([0, 0], [1, 0]), fromPointNormal([0, 0], [-1, 1])), 45); // never above 90°
  near(angleBetween(fromTwoPoints([0, 0], [1, 1]), fromTwoPoints([0, 0], [3, 3])), 0, 1e-5);
  assert.equal(relation(fromPointNormal([0, 0], [1, 2]), fromPointNormal([1, 1], [-2, 1])).perpendicular, true);
});

test("distance from a point to a line", () => {
  const l = fromPointNormal([0, 2], [3, 4]); // 3x + 4y − 8 = 0
  near(distance(l, [4, 4]), Math.abs(12 + 16 - 8) / 5);
  near(distance(l, [0, 2]), 0);
  const F = foot(l, [4, 4]);
  near(value(l, F), 0);
  near(Math.hypot(F[0] - 4, F[1] - 4), 4);
});

test("initial state: both lines defined, crossing, not perpendicular", () => {
  const s = initialState();
  assert.equal(generalText(line1(s)), "x − 2y + 1 = 0");
  const r = relation(line1(s), line2(s));
  assert.equal(r.kind, "intersect");
  assert.equal(r.perpendicular, false);
  for (const mode of ["point-direction", "point-normal"]) assert.ok(line1({ ...s, mode }));
});
